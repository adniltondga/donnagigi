/**
 * Helper compartilhado: lista todos os anúncios ATIVOS de um seller no
 * Mercado Livre, com título, thumbnail, estoque e variações (com qty
 * por variação).
 *
 * Usado pelos endpoints `/api/ml/all-listings` e
 * `/api/produtos/recomendacoes`. Evita duplicar a lógica de paginação
 * e multiget em vários lugares.
 */

import { loggedFetch } from "./api-log"

export interface ActiveListing {
  mlListingId: string
  title: string
  thumbnail: string | null
  stock: number
  hasVariations: boolean
  byVariation: Record<string, number>
  variationNames: Record<string, string>
}

interface MultigetVariation {
  id: number | string
  available_quantity?: number
  attribute_combinations?: Array<{ name?: string; value_name?: string }>
}
interface MultigetItem {
  id: string
  title?: string
  thumbnail?: string
  secure_thumbnail?: string
  available_quantity?: number
  variations?: MultigetVariation[]
}
interface MultigetEntry {
  code: number
  body?: MultigetItem
}

const PAGE = 50
const MAX_PAGES = 10
const BATCH = 20

export async function fetchActiveListings(
  accessToken: string,
  sellerID: string,
  tenantId?: string | null
): Promise<ActiveListing[]> {
  const headers = { Authorization: `Bearer ${accessToken}` }

  // 1) Lista IDs ativos do seller — paginado
  const allIds: string[] = []
  for (let p = 0; p < MAX_PAGES; p++) {
    const offset = p * PAGE
    const url = `https://api.mercadolibre.com/users/${sellerID}/items/search?status=active&limit=${PAGE}&offset=${offset}`
    const r = await loggedFetch(url, {
      headers,
      provider: "ml",
      tenantId,
      endpoint: "/users/{id}/items/search",
    })
    if (!r.ok) break
    const data = (await r.json()) as { results?: string[] }
    const results = Array.isArray(data.results) ? data.results : []
    allIds.push(...results)
    if (results.length < PAGE) break
  }

  if (allIds.length === 0) return []

  // 2) Multiget detalhes — batches de 20
  const items: ActiveListing[] = []
  for (let i = 0; i < allIds.length; i += BATCH) {
    const slice = allIds.slice(i, i + BATCH)
    const url = `https://api.mercadolibre.com/items?ids=${slice.join(",")}&attributes=id,title,thumbnail,secure_thumbnail,available_quantity,variations`
    const r = await loggedFetch(url, {
      headers,
      provider: "ml",
      tenantId,
      endpoint: "/items?multiget",
    })
    if (!r.ok) continue
    const data = (await r.json()) as MultigetEntry[]
    if (!Array.isArray(data)) continue
    for (const entry of data) {
      if (entry.code !== 200 || !entry.body) continue
      const item = entry.body
      const id = item.id?.toUpperCase()
      if (!id) continue

      const thumb = item.secure_thumbnail
        ? item.secure_thumbnail
        : item.thumbnail
        ? item.thumbnail.replace(/^http:\/\//, "https://")
        : null

      const variations = Array.isArray(item.variations) ? item.variations : []
      const byVariation: Record<string, number> = {}
      const variationNames: Record<string, string> = {}
      for (const v of variations) {
        if (v?.id == null) continue
        const vid = String(v.id)
        if (Number.isFinite(v.available_quantity)) {
          byVariation[vid] = Number(v.available_quantity)
        }
        // Nome legível: "Azul · iPhone 15PM" (junta value_name de cada attr)
        const combo = (v.attribute_combinations || [])
          .map((a) => a?.value_name)
          .filter((s): s is string => !!s)
        if (combo.length > 0) variationNames[vid] = combo.join(" · ")
      }

      items.push({
        mlListingId: id,
        title: item.title || "",
        thumbnail: thumb,
        stock: Number(item.available_quantity ?? 0),
        hasVariations: variations.length > 0,
        byVariation,
        variationNames,
      })
    }
  }

  return items
}
