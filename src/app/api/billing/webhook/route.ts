import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { asaasValidateWebhookToken } from "@/lib/asaas"

export const dynamic = "force-dynamic"

/**
 * Recebe webhooks do Asaas e atualiza Subscription/Invoice locais.
 *
 * Autenticação: header `asaas-access-token` (configurado na dashboard
 * do Asaas, mesmo valor que o .env ASAAS_WEBHOOK_TOKEN).
 *
 * Eventos tratados:
 *  - PAYMENT_CONFIRMED / PAYMENT_RECEIVED → subscription ACTIVE
 *  - PAYMENT_OVERDUE → OVERDUE
 *  - PAYMENT_REFUNDED / PAYMENT_REFUND_IN_PROGRESS → CANCELED
 *  - SUBSCRIPTION_INACTIVATED → CANCELED
 *  - SUBSCRIPTION_DELETED → EXPIRED + plan=FREE
 *
 * Idempotente: re-executar o mesmo webhook não produz efeito colateral.
 */

interface AsaasWebhookPayload {
  event: string
  dateCreated?: string
  payment?: {
    id: string
    subscription?: string
    value?: number
    dueDate?: string
    paymentDate?: string | null
    status?: string
    invoiceUrl?: string | null
    bankSlipUrl?: string | null
    billingType?: string
  }
  subscription?: {
    id: string
    customer?: string
    status?: string
    nextDueDate?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("asaas-access-token")
    if (!asaasValidateWebhookToken(token)) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 })
    }

    const payload = (await request.json()) as AsaasWebhookPayload
    const event = payload.event
    console.log(`[billing/webhook] evento ASAAS: ${event}`)

    const asaasSubId = payload.subscription?.id ?? payload.payment?.subscription
    if (!asaasSubId) {
      console.warn(`[billing/webhook] ${event} sem subscription id — ignorado`)
      return NextResponse.json({ ok: true, skipped: true })
    }

    const sub = await prisma.subscription.findFirst({
      where: { asaasSubscriptionId: asaasSubId },
    })
    if (!sub) {
      console.warn(`[billing/webhook] subscription Asaas ${asaasSubId} não encontrada localmente`)
      return NextResponse.json({ ok: true, skipped: true })
    }

    // Atualiza Invoice se o evento tem payment
    if (payload.payment) {
      const p = payload.payment
      await prisma.invoice.upsert({
        where: { asaasPaymentId: p.id },
        create: {
          subscriptionId: sub.id,
          asaasPaymentId: p.id,
          value: p.value || 0,
          status: p.status || "PENDING",
          billingType: (p.billingType as any) || sub.billingType,
          dueDate: p.dueDate ? new Date(`${p.dueDate}T00:00:00`) : new Date(),
          paymentDate: p.paymentDate ? new Date(p.paymentDate) : null,
          invoiceUrl: p.invoiceUrl || null,
          bankSlipUrl: p.bankSlipUrl || null,
        },
        update: {
          status: p.status || undefined,
          paymentDate: p.paymentDate ? new Date(p.paymentDate) : null,
          invoiceUrl: p.invoiceUrl || undefined,
          bankSlipUrl: p.bankSlipUrl || undefined,
        },
      })
    }

    // Atualiza Subscription de acordo com o evento
    let subPatch: Parameters<typeof prisma.subscription.update>[0]["data"] | null = null

    switch (event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        const nextDue = payload.subscription?.nextDueDate
        subPatch = {
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: nextDue ? new Date(`${nextDue}T00:00:00`) : null,
        }
        break
      }
      case "PAYMENT_OVERDUE":
        subPatch = { status: "OVERDUE" }
        break
      case "PAYMENT_REFUNDED":
      case "PAYMENT_REFUND_IN_PROGRESS":
      case "SUBSCRIPTION_INACTIVATED":
        subPatch = {
          status: "CANCELED",
          canceledAt: sub.canceledAt ?? new Date(),
        }
        break
      case "SUBSCRIPTION_DELETED":
        subPatch = {
          status: "EXPIRED",
          plan: "FREE",
          canceledAt: sub.canceledAt ?? new Date(),
        }
        break
    }

    if (subPatch) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: subPatch,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("[billing/webhook] erro:", error)
    return NextResponse.json(
      { error: error?.message || "Erro ao processar webhook" },
      { status: 500 }
    )
  }
}
