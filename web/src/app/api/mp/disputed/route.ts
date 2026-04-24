import { NextResponse } from "next/server"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { fetchMPDisputedPayments, getMPIntegrationForTenant } from "@/lib/mp"

export const dynamic = "force-dynamic"

/**
 * GET /api/mp/disputed
 * Pagamentos em mediação — dinheiro retido por reclamação do comprador.
 */
export async function GET() {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const integration = await getMPIntegrationForTenant(tenantId)
    if (!integration) {
      return NextResponse.json(
        { configured: false, error: "Mercado Pago não conectado." },
        { status: 400 }
      )
    }

    try {
      const payments = await fetchMPDisputedPayments({
        accessToken: integration.accessToken,
      })
      const total = Math.round(payments.reduce((s, p) => s + p.netAmount, 0) * 100) / 100
      return NextResponse.json({
        configured: true,
        total,
        count: payments.length,
        payments,
        lastUpdated: new Date().toISOString(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao consultar MP"
      return NextResponse.json({ configured: true, error: msg }, { status: 502 })
    }
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[mp/disputed]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
