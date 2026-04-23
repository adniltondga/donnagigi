import { NextResponse } from "next/server"
import { getSession } from "@/lib/tenant"
import { getOrCreateSubscription, trialDaysLeft, canUseProduct } from "@/lib/subscription"
import { planInfo } from "@/lib/plans"

export const dynamic = "force-dynamic"

/**
 * Retorna a subscription do tenant logado + info derivada pra UI:
 * - dias restantes do trial
 * - se pode usar o produto
 * - detalhes do plano (preço, features)
 */
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const sub = await getOrCreateSubscription(session.tenantId)
  const info = planInfo(sub.plan)
  return NextResponse.json({
    subscription: sub,
    plan: info,
    trialDaysLeft: trialDaysLeft(sub),
    canUse: canUseProduct(sub),
  })
}
