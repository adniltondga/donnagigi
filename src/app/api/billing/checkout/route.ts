import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"
import { planInfo } from "@/lib/plans"
import {
  asaasCreateCustomer,
  asaasCreateSubscription,
  asaasListSubscriptionPayments,
  nextDueDateISO,
  type AsaasBillingType,
} from "@/lib/asaas"

export const dynamic = "force-dynamic"

/**
 * Cria a assinatura paga no Asaas. Se o tenant já tem customer Asaas
 * cadastrado, reaproveita. Retorna a Subscription local atualizada
 * + lista de pagamentos (com invoiceUrl pra PIX/Boleto).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await request.json()
    const plan = String(body.plan || "").toUpperCase()
    const billingType = String(body.billingType || "").toUpperCase() as AsaasBillingType
    const cpfCnpj = String(body.cpfCnpj || "").trim()
    const mobilePhone = body.mobilePhone ? String(body.mobilePhone).trim() : undefined

    if (plan !== "PRO") {
      return NextResponse.json(
        { error: "Plano inválido. Use 'PRO'." },
        { status: 400 }
      )
    }
    if (!["PIX", "BOLETO", "CREDIT_CARD"].includes(billingType)) {
      return NextResponse.json(
        { error: "Método de pagamento inválido" },
        { status: 400 }
      )
    }
    if (!cpfCnpj || cpfCnpj.replace(/\D/g, "").length < 11) {
      return NextResponse.json({ error: "CPF/CNPJ inválido" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, name: true, email: true, tenantId: true },
    })
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    let subscription = await prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
    })

    // Bloqueia duplicidade: subscription paga já ativa
    if (
      subscription &&
      subscription.plan !== "FREE" &&
      (subscription.status === "ACTIVE" || subscription.status === "PENDING")
    ) {
      return NextResponse.json(
        { error: "Você já tem uma assinatura paga ativa. Cancele antes de criar uma nova." },
        { status: 409 }
      )
    }

    const info = planInfo("PRO")

    // Cria customer no Asaas se ainda não existir
    let asaasCustomerId = subscription?.asaasCustomerId ?? null
    if (!asaasCustomerId) {
      const customer = await asaasCreateCustomer({
        name: user.name,
        cpfCnpj,
        email: user.email,
        mobilePhone,
      })
      asaasCustomerId = customer.id
    }

    const due = nextDueDateISO(3)
    const asaasSub = await asaasCreateSubscription({
      customerId: asaasCustomerId,
      billingType,
      value: info.priceBRL,
      nextDueDate: due,
      description: `agLivre — Plano ${info.name}`,
    })

    // Persiste local
    const baseData = {
      plan: "PRO" as const,
      status: "PENDING" as const,
      billingType,
      value: info.priceBRL,
      asaasCustomerId,
      asaasSubscriptionId: asaasSub.id,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(`${due}T00:00:00`),
      canceledAt: null,
    }

    if (subscription) {
      subscription = await prisma.subscription.update({
        where: { tenantId: user.tenantId },
        data: baseData,
      })
    } else {
      subscription = await prisma.subscription.create({
        data: { tenantId: user.tenantId, ...baseData },
      })
    }

    // Primeiros pagamentos (com invoiceUrl pra PIX/boleto)
    let payments: Array<any> = []
    try {
      payments = await asaasListSubscriptionPayments(asaasSub.id)

      // Grava Invoices locais em upsert
      for (const p of payments) {
        await prisma.invoice.upsert({
          where: { asaasPaymentId: p.id },
          create: {
            subscriptionId: subscription.id,
            asaasPaymentId: p.id,
            value: p.value,
            status: p.status,
            billingType: billingType,
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
      console.error("[billing/checkout] falha ao listar payments iniciais:", err)
    }

    return NextResponse.json({ subscription, payments })
  } catch (error: any) {
    console.error("[billing/checkout] erro:", error)
    return NextResponse.json(
      { error: error?.message || "Erro ao processar checkout" },
      { status: 500 }
    )
  }
}
