/**
 * Webhook do Mercado Pago — recebe notificações em tempo real de
 * pagamentos, liberações e mudanças de status.
 *
 * Formatos aceitos:
 *  - Query string: /webhook?type=payment&id=123&data.id=123&user_id=456
 *  - Body JSON (v2): { type: "payment", data: { id: "123" }, user_id: 456 }
 *  - Action variants: "payment.created", "payment.updated"
 *
 * Estratégia simples: ao receber qualquer notificação de payment, a gente
 * dispara syncAndCacheMP pro tenant dono do mpUserId. Isso refresha todo
 * o snapshot (unavailable_balance, listas pending/released/disputed).
 *
 * MP exige resposta em <22s, mas idealmente <5s. A gente retorna 200 na
 * hora e não bloqueia — se o sync falhar, no pior caso o cron diário
 * corrige.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { syncAndCacheMP } from "@/lib/mp"
import { createNotification } from "@/lib/notifications"
import { formatCurrency } from "@/lib/calculations"

export const dynamic = "force-dynamic"

/**
 * Roda o sync do MP e dispara notificação in-app (sininho) se
 * houve liberação ou disputa nova desde a última sincronização.
 *
 * Threshold de R$ 0,01 evita ruído de arredondamento. Notificação
 * é criada per-evento (cada webhook que detectou movimento).
 */
async function syncAndNotify(tenantId: string) {
  try {
    const before = await prisma.mPIntegration.findUnique({
      where: { tenantId },
      select: { cachedReleasedTotal: true, cachedDisputedTotal: true },
    })
    const r = await syncAndCacheMP(tenantId)
    console.log("[mp-webhook] sync ok:", tenantId, r.cachedSyncedAt)
    const after = await prisma.mPIntegration.findUnique({
      where: { tenantId },
      select: { cachedReleasedTotal: true, cachedDisputedTotal: true },
    })
    if (!before || !after) return

    const releasedDelta =
      (after.cachedReleasedTotal ?? 0) - (before.cachedReleasedTotal ?? 0)
    if (releasedDelta > 0.01) {
      await createNotification({
        tenantId,
        type: "mp_release",
        title: `Mercado Pago liberou ${formatCurrency(releasedDelta)}`,
        body: `Saldo total liberado: ${formatCurrency(after.cachedReleasedTotal ?? 0)}.`,
        link: "/admin/financeiro/painel",
      })
    }

    const disputedDelta =
      (after.cachedDisputedTotal ?? 0) - (before.cachedDisputedTotal ?? 0)
    if (disputedDelta > 0.01) {
      await createNotification({
        tenantId,
        type: "mp_release",
        title: `Disputa nova no Mercado Pago: ${formatCurrency(disputedDelta)} retido`,
        body: "Verifique o card MP no Painel — pode precisar responder ao comprador.",
        link: "/admin/financeiro/painel",
      })
    }
  } catch (e) {
    console.error("[mp-webhook] sync/notify falhou:", tenantId, e)
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const qs = url.searchParams
    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch {
      // MP às vezes manda notificação sem corpo JSON
    }

    const type = (body.type as string) || qs.get("type") || qs.get("topic") || ""
    const action = (body.action as string) || ""
    const userIdRaw =
      (body.user_id as string | number | undefined) ??
      qs.get("user_id") ??
      (body as { data?: { user_id?: string | number } }).data?.user_id
    const userId = userIdRaw ? String(userIdRaw) : null

    console.log("[mp-webhook]", { type, action, userId })

    // Só tratamos payment. Os outros (merchant_order, etc) caem no cron.
    const isPayment = type === "payment" || action.startsWith("payment.")
    if (!isPayment) {
      return NextResponse.json({ status: "ignored", type }, { status: 200 })
    }

    if (!userId) {
      console.warn("[mp-webhook] payment sem user_id — ignorando")
      return NextResponse.json({ status: "ignored", reason: "no user_id" }, { status: 200 })
    }

    const integration = await prisma.mPIntegration.findFirst({
      where: { mpUserId: userId },
      select: { tenantId: true },
    })
    if (!integration) {
      console.warn("[mp-webhook] user_id desconhecido:", userId)
      // Não é erro — pode ser um seller que não assinou o agLivre
      return NextResponse.json({ status: "unknown_seller" }, { status: 200 })
    }

    // Roda o sync + notificação sem bloquear. Response 200 volta rápido pro MP.
    void syncAndNotify(integration.tenantId)

    return NextResponse.json({ status: "received", tenantId: integration.tenantId }, { status: 200 })
  } catch (err) {
    console.error("[mp-webhook] erro:", err)
    return NextResponse.json({ error: "erro ao processar" }, { status: 500 })
  }
}

/**
 * GET /api/mercadopago/webhook — MP não faz handshake como o ML, mas
 * alguns testes manuais usam GET. Devolve 200 pra facilitar debug.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Mercado Pago webhook endpoint. POST notifications here.",
  })
}
