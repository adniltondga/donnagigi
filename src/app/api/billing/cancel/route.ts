import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"
import { asaasCancelSubscription } from "@/lib/asaas"
import { sendSubscriptionCanceledEmail } from "@/lib/dunning"
import { captureError } from "@/lib/sentry"

export const dynamic = "force-dynamic"

/**
 * Cancela a assinatura paga do tenant. Marca status=CANCELED local e
 * chama DELETE no Asaas (best-effort — se ASAAS der erro, ainda marcamos
 * local pra não prender o cliente).
 */
export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  if (session.role !== "OWNER") {
    return NextResponse.json(
      { error: "Apenas o dono pode cancelar a assinatura" },
      { status: 403 }
    )
  }

  const sub = await prisma.subscription.findUnique({
    where: { tenantId: session.tenantId },
  })
  if (!sub) {
    return NextResponse.json({ error: "Sem assinatura ativa" }, { status: 404 })
  }

  if (sub.asaasSubscriptionId) {
    try {
      await asaasCancelSubscription(sub.asaasSubscriptionId)
    } catch (err) {
      captureError(err, {
        tenantId: session.tenantId,
        operation: "billing-cancel-asaas",
        extra: { asaasSubscriptionId: sub.asaasSubscriptionId },
      })
    }
  }

  const updated = await prisma.subscription.update({
    where: { tenantId: session.tenantId },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
    },
  })

  void sendSubscriptionCanceledEmail({
    tenantId: session.tenantId,
    periodEnd: updated.currentPeriodEnd,
  })

  return NextResponse.json({ ok: true, subscription: updated })
}
