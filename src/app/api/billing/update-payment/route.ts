import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"
import { planInfo } from "@/lib/plans"
import {
  asaasCancelSubscription,
  asaasCreateCustomer,
  asaasCreateSubscription,
  asaasListSubscriptionPayments,
  nextDueDateISO,
  type AsaasBillingType,
} from "@/lib/asaas"
import { captureError } from "@/lib/sentry"

export const dynamic = "force-dynamic"

/**
 * Troca o método de pagamento da assinatura ativa sem cancelar a
 * conta. Cancela a subscription antiga no ASAAS (best-effort) e cria
 * uma nova com o novo billingType. Status local volta pra PENDING
 * até o próximo PAYMENT_CONFIRMED chegar via webhook.
 *
 * Casos de uso:
 *  - Cartão expirou / cliente quer trocar pra novo
 *  - Quer migrar de PIX/Boleto pra Cartão (cobrança automática)
 *  - Quer migrar de Cartão pra PIX (cancelar débito recorrente)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }
    if (session.role !== "OWNER") {
      return NextResponse.json(
        { error: "Apenas o dono pode trocar o método de pagamento" },
        { status: 403 },
      )
    }

    const body = await request.json()
    const billingType = String(body.billingType || "").toUpperCase() as AsaasBillingType
    const cpfCnpj = body.cpfCnpj ? String(body.cpfCnpj).trim() : ""
    const mobilePhone = body.mobilePhone ? String(body.mobilePhone).trim() : undefined

    if (!["PIX", "BOLETO", "CREDIT_CARD"].includes(billingType)) {
      return NextResponse.json(
        { error: "Método de pagamento inválido" },
        { status: 400 },
      )
    }

    const sub = await prisma.subscription.findUnique({
      where: { tenantId: session.tenantId },
    })
    if (!sub) {
      return NextResponse.json(
        { error: "Sem assinatura ativa pra atualizar" },
        { status: 404 },
      )
    }

    if (sub.plan === "FREE") {
      return NextResponse.json(
        { error: "Plano Free não tem método de pagamento — escolha um plano pago primeiro" },
        { status: 400 },
      )
    }

    // Cancela subscription antiga no ASAAS (best-effort)
    if (sub.asaasSubscriptionId) {
      try {
        await asaasCancelSubscription(sub.asaasSubscriptionId)
      } catch (err) {
        captureError(err, {
          tenantId: session.tenantId,
          operation: "update-payment-cancel-old",
        })
      }
    }

    // Customer ASAAS — reaproveita ou cria
    let asaasCustomerId = sub.asaasCustomerId ?? null
    if (!asaasCustomerId) {
      if (!cpfCnpj || cpfCnpj.replace(/\D/g, "").length < 11) {
        return NextResponse.json(
          { error: "CPF/CNPJ é obrigatório pra criar customer no ASAAS" },
          { status: 400 },
        )
      }
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { name: true, email: true },
      })
      const customer = await asaasCreateCustomer({
        name: user?.name || "Cliente agLivre",
        cpfCnpj,
        email: user?.email,
        mobilePhone,
      })
      asaasCustomerId = customer.id
    }

    const info = planInfo(sub.plan)
    const due = nextDueDateISO(3)
    const newSub = await asaasCreateSubscription({
      customerId: asaasCustomerId,
      billingType,
      value: info.priceBRL,
      nextDueDate: due,
      description: `agLivre — Plano ${info.name} (atualização de pagamento)`,
    })

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        billingType,
        asaasCustomerId,
        asaasSubscriptionId: newSub.id,
        status: "PENDING",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(`${due}T00:00:00`),
        canceledAt: null,
      },
    })

    // Lista payments iniciais e upserta Invoices
    let payments: Array<unknown> = []
    try {
      const list = await asaasListSubscriptionPayments(newSub.id)
      payments = list
      for (const p of list) {
        await prisma.invoice.upsert({
          where: { asaasPaymentId: p.id },
          create: {
            subscriptionId: updated.id,
            asaasPaymentId: p.id,
            value: p.value,
            status: p.status,
            billingType,
            dueDate: new Date(`${p.dueDate}T00:00:00`),
            paymentDate: p.paymentDate ? new Date(p.paymentDate) : null,
            invoiceUrl: p.invoiceUrl || null,
            bankSlipUrl: p.bankSlipUrl || null,
          },
          update: {
            status: p.status,
            paymentDate: p.paymentDate ? new Date(p.paymentDate) : null,
            invoiceUrl: p.invoiceUrl || null,
            bankSlipUrl: p.bankSlipUrl || null,
          },
        })
      }
    } catch (err) {
      captureError(err, {
        tenantId: session.tenantId,
        operation: "update-payment-list",
      })
    }

    return NextResponse.json({ ok: true, subscription: updated, payments })
  } catch (error) {
    captureError(error, { operation: "update-payment" })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar pagamento" },
      { status: 500 },
    )
  }
}
