import { NextRequest, NextResponse } from "next/server"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { getMLIntegrationForTenant } from "@/lib/ml"
import { syncRefundsForTenant } from "@/lib/refund-sync"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * POST /api/financeiro/devolucoes/sync?since=YYYY-MM-DD
 *
 * Dispara detecção de devoluções pra o tenant atual via API do ML.
 * Se `since` não vier, usa default da função (60 dias atrás).
 * Use pra rodar manualmente via botão na UI quando o cron diário
 * ainda não passou.
 */
export async function POST(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const integration = await getMLIntegrationForTenant(tenantId)
    if (!integration) {
      return NextResponse.json(
        { error: "Integração com Mercado Livre não configurada" },
        { status: 400 },
      )
    }

    const sinceStr = req.nextUrl.searchParams.get("since")
    const since = sinceStr ? new Date(`${sinceStr}T00:00:00`) : undefined
    if (sinceStr && Number.isNaN(since?.getTime())) {
      return NextResponse.json({ error: "Parâmetro since inválido" }, { status: 400 })
    }

    const stats = await syncRefundsForTenant({
      tenantId,
      accessToken: integration.accessToken,
      since,
    })

    return NextResponse.json({ ok: true, stats })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[devolucoes/sync POST]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 },
    )
  }
}
