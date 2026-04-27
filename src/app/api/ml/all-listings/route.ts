import { NextResponse } from "next/server"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { getMLIntegrationForTenant } from "@/lib/ml"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { fetchActiveListings } from "@/lib/ml-listings"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * GET /api/ml/all-listings — lista todos os anúncios ATIVOS do seller
 * direto no ML, com título, thumbnail, estoque e variações.
 *
 * Lógica em `lib/ml-listings.ts` pra ser reutilizável.
 */
export async function GET() {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()
    const integration = await getMLIntegrationForTenant(tenantId)
    if (!integration) {
      return NextResponse.json({ erro: "Mercado Livre não conectado" }, { status: 400 })
    }

    const items = await fetchActiveListings(integration.accessToken, integration.sellerID, tenantId)
    return NextResponse.json({ items, total: items.length })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[ml/all-listings]", err)
    return NextResponse.json({ erro: "Erro ao listar anúncios" }, { status: 500 })
  }
}
