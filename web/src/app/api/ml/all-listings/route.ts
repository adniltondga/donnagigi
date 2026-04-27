import { NextResponse } from "next/server"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { getMLIntegrationForTenant } from "@/lib/ml"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

interface ListingItem {
  mlListingId: string
  title: string
  thumbnail: string | null
  stock: number
  hasVariations: boolean
  byVariation: Record<string, number>
}

/**
 * GET /api/ml/all-listings
 *
 * Lista TODOS os anúncios ativos do seller direto no ML — passa pelo
 * `/users/{seller}/items/search?status=active` paginado e depois faz
 * multiget pra pegar `title`, `available_quantity` e `variations`.
 *
 * Diferente de `/api/ml/custos` (que lista só o que já vendeu ou tem
 * custo cadastrado), aqui aparece tudo o que está no ar — inclusive
 * anúncios novos sem venda nenhuma.
 *
 * Cap: ~500 listings (10 páginas de 50). Sellers maiores precisarão
 * de paginação no client futuramente.
 */
export async function GET() {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()
    const integration = await getMLIntegrationForTenant(tenantId)
    if (!integration) {
      return NextResponse.json({ erro: "Mercado Livre não conectado" }, { status: 400 })
    }

    const headers = { Authorization: `Bearer ${integration.accessToken}` }

    // 1) Lista IDs ativos do seller — paginado
    const allIds: string[] = []
    const PAGE = 50
    const MAX_PAGES = 10
    for (let p = 0; p < MAX_PAGES; p++) {
      const offset = p * PAGE
      const url = `https://api.mercadolibre.com/users/${integration.sellerID}/items/search?status=active&limit=${PAGE}&offset=${offset}`
      const r = await fetch(url, { headers })
      if (!r.ok) break
      const data = (await r.json()) as { results?: string[]; paging?: { total?: number } }
      const results = Array.isArray(data.results) ? data.results : []
      allIds.push(...results)
      if (results.length < PAGE) break
    }

    if (allIds.length === 0) {
      return NextResponse.json({ items: [] })
    }

    // 2) Multiget detalhes — batches de 20
    type Variation = { id: number | string; available_quantity?: number }
    type Item = {
      id: string
      title?: string
      thumbnail?: string
      secure_thumbnail?: string
      available_quantity?: number
      variations?: Variation[]
    }
    type ApiEntry = { code: number; body?: Item }
    const items: ListingItem[] = []
    const BATCH = 20
    for (let i = 0; i < allIds.length; i += BATCH) {
      const slice = allIds.slice(i, i + BATCH)
      const url = `https://api.mercadolibre.com/items?ids=${slice.join(",")}&attributes=id,title,thumbnail,secure_thumbnail,available_quantity,variations`
      const r = await fetch(url, { headers })
      if (!r.ok) continue
      const data = (await r.json()) as ApiEntry[]
      if (!Array.isArray(data)) continue
      for (const entry of data) {
        if (entry.code !== 200 || !entry.body) continue
        const item = entry.body
        const id = item.id?.toUpperCase()
        if (!id) continue
        const variations = Array.isArray(item.variations) ? item.variations : []
        const byVariation: Record<string, number> = {}
        for (const v of variations) {
          if (v?.id != null && Number.isFinite(v.available_quantity)) {
            byVariation[String(v.id)] = Number(v.available_quantity)
          }
        }
        // Prefere secure_thumbnail (HTTPS); fallback no thumbnail trocando o scheme.
        const thumb = item.secure_thumbnail
          ? item.secure_thumbnail
          : item.thumbnail
          ? item.thumbnail.replace(/^http:\/\//, "https://")
          : null
        items.push({
          mlListingId: id,
          title: item.title || "",
          thumbnail: thumb,
          stock: Number(item.available_quantity ?? 0),
          hasVariations: variations.length > 0,
          byVariation,
        })
      }
    }

    return NextResponse.json({ items, total: items.length })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[ml/all-listings]", err)
    return NextResponse.json({ erro: "Erro ao listar anúncios" }, { status: 500 })
  }
}
