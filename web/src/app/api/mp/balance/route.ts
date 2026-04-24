import { NextResponse } from "next/server"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { fetchMPBalance, getMPIntegrationForTenant } from "@/lib/mp"

export const dynamic = "force-dynamic"

/**
 * GET /api/mp/balance
 * Retorna o saldo da conta MP do tenant logado (available / unavailable / total).
 * unavailableBalance = "Total a liberar" (dinheiro preso aguardando data de liberação).
 */
export async function GET() {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const integration = await getMPIntegrationForTenant(tenantId)
    if (!integration) {
      return NextResponse.json(
        { configured: false, error: "Mercado Pago não conectado nesse tenant." },
        { status: 400 }
      )
    }

    try {
      const balance = await fetchMPBalance({ accessToken: integration.accessToken })
      return NextResponse.json({ configured: true, ...balance })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao consultar MP"
      return NextResponse.json({ configured: true, error: msg }, { status: 502 })
    }
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[mp/balance]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
