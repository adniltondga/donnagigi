import { NextResponse } from 'next/server'
import { getTenantIdOrDefault } from '@/lib/tenant'
import { getMLIntegrationForTenant } from '@/lib/ml'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SALE_FEE_PCT = 0.18

interface MLAttributeCombination {
  name: string
  value_name: string
}

interface MLVariation {
  id: number
  price: number
  available_quantity: number
  attribute_combinations: MLAttributeCombination[]
}

interface MLItemBody {
  id: string
  title: string
  price: number
  status: string
  available_quantity: number
  parent_item_id: string | null
  variations: MLVariation[]
}

interface MLBatchEntry {
  code: number
  body: MLItemBody
}

export interface PotencialItem {
  mlListingId: string
  variationId: string | null
  title: string
  variationName: string | null
  status: string
  price: number
  qty: number
  productCost: number | null
  bruto: number
  taxaML: number
  liquido: number
  custoTotal: number | null
  lucro: number | null
  margem: number | null
}

async function fetchAllIds(sellerId: string, token: string): Promise<string[]> {
  const ids: string[] = []
  let offset = 0
  const limit = 100
  while (true) {
    const res = await fetch(
      `https://api.mercadolibre.com/users/${sellerId}/items/search?offset=${offset}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) break
    const json = (await res.json()) as { results?: string[] }
    const results = json.results ?? []
    ids.push(...results)
    if (results.length < limit) break
    offset += limit
  }
  return ids
}

async function fetchItemsBatch(ids: string[], token: string): Promise<MLItemBody[]> {
  const items: MLItemBody[] = []
  const BATCH = 20
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const res = await fetch(
      `https://api.mercadolibre.com/items?ids=${batch.join(',')}&attributes=id,title,price,status,available_quantity,parent_item_id,variations`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) continue
    const json = (await res.json()) as MLBatchEntry[]
    for (const entry of json) {
      if (entry.code === 200 && entry.body) items.push(entry.body)
    }
  }
  return items
}

function calcItem(price: number, qty: number, cost: number | null): Omit<PotencialItem, 'mlListingId' | 'variationId' | 'title' | 'variationName' | 'status' | 'price' | 'qty' | 'productCost'> {
  const bruto = price * qty
  const taxaML = bruto * SALE_FEE_PCT
  const liquido = bruto - taxaML
  const custoTotal = cost != null ? cost * qty : null
  const lucro = custoTotal != null ? liquido - custoTotal : null
  const margem = lucro != null && bruto > 0 ? (lucro / bruto) * 100 : null
  return { bruto, taxaML, liquido, custoTotal, lucro, margem }
}

export async function GET() {
  try {
    const tenantId = await getTenantIdOrDefault()
    const integration = await getMLIntegrationForTenant(tenantId)

    if (!integration) {
      return NextResponse.json({ erro: 'Integração ML não configurada' }, { status: 400 })
    }

    const { sellerID, accessToken } = integration

    const allIds = await fetchAllIds(sellerID, accessToken)
    const mlItems = await fetchItemsBatch(allIds, accessToken)

    const [listingCosts, variantCosts] = await Promise.all([
      prisma.mLProductCost.findMany({ where: { tenantId } }),
      prisma.mLProductVariantCost.findMany({ where: { tenantId } }),
    ])

    const listingCostMap = new Map(listingCosts.map((c) => [c.mlListingId, c.productCost]))
    const variantCostMap = new Map(
      variantCosts.map((v) => [`${v.mlListingId}|${v.variationId}`, v.productCost]),
    )

    const itemById = new Map(mlItems.map((i) => [i.id, i]))
    const childrenByParent = new Map<string, MLItemBody[]>()
    const topLevel: MLItemBody[] = []

    for (const item of mlItems) {
      if (item.parent_item_id && itemById.has(item.parent_item_id)) {
        const list = childrenByParent.get(item.parent_item_id) ?? []
        list.push(item)
        childrenByParent.set(item.parent_item_id, list)
      } else {
        topLevel.push(item)
      }
    }

    const lines: PotencialItem[] = []

    for (const item of topLevel) {
      if (item.status !== 'active') continue

      const children = childrenByParent.get(item.id) ?? []
      const hasNativeVariations = item.variations && item.variations.length > 0
      const hasChildren = children.length > 0

      if (hasChildren) {
        for (const child of children) {
          if (child.status !== 'active' || child.available_quantity <= 0) continue
          // Cascata: cost cadastrado no próprio child > cost cadastrado no pai > null.
          // Antes só consultava child.id e considerava qualquer pai cadastrado como
          // "sem custo" — gerava falsos positivos no contador `semCusto`.
          const cost =
            listingCostMap.get(child.id) ?? listingCostMap.get(item.id) ?? null
          lines.push({
            mlListingId: child.id,
            variationId: null,
            title: item.title,
            variationName: child.title,
            status: child.status,
            price: child.price,
            qty: child.available_quantity,
            productCost: cost,
            ...calcItem(child.price, child.available_quantity, cost),
          })
        }
      } else if (hasNativeVariations) {
        for (const v of item.variations) {
          if (v.available_quantity <= 0) continue
          const varKey = `${item.id}|${v.id}`
          const cost = variantCostMap.get(varKey) ?? listingCostMap.get(item.id) ?? null
          const varName = v.attribute_combinations?.map((a) => a.value_name).join(' · ') ?? null
          lines.push({
            mlListingId: item.id,
            variationId: String(v.id),
            title: item.title,
            variationName: varName,
            status: item.status,
            price: v.price,
            qty: v.available_quantity,
            productCost: cost,
            ...calcItem(v.price, v.available_quantity, cost),
          })
        }
      } else {
        const qty = item.available_quantity
        if (qty <= 0) continue
        const cost = listingCostMap.get(item.id) ?? null
        lines.push({
          mlListingId: item.id,
          variationId: null,
          title: item.title,
          variationName: null,
          status: item.status,
          price: item.price,
          qty,
          productCost: cost,
          ...calcItem(item.price, qty, cost),
        })
      }
    }

    lines.sort((a, b) => b.bruto - a.bruto)

    const totalBruto = lines.reduce((s, l) => s + l.bruto, 0)
    const totalTaxaML = lines.reduce((s, l) => s + l.taxaML, 0)
    const totalLiquido = lines.reduce((s, l) => s + l.liquido, 0)
    const totalCusto = lines.reduce((s, l) => s + (l.custoTotal ?? 0), 0)
    const totalLucro = lines.reduce((s, l) => s + (l.lucro ?? 0), 0)
    const totalUnidades = lines.reduce((s, l) => s + l.qty, 0)
    const ticketMedio = totalUnidades > 0 ? totalBruto / totalUnidades : 0
    const margemMedia = totalBruto > 0 ? (totalLucro / totalBruto) * 100 : 0
    const semCusto = lines.filter((l) => l.productCost == null).length

    return NextResponse.json({
      lines,
      summary: {
        totalAnuncios: lines.length,
        totalUnidades,
        totalBruto,
        totalTaxaML,
        totalLiquido,
        totalCusto,
        totalLucro,
        ticketMedio,
        margemMedia,
        semCusto,
        taxaPct: SALE_FEE_PCT * 100,
      },
    })
  } catch (error) {
    console.error('[potencial-estoque] erro:', error)
    return NextResponse.json(
      { erro: 'Falha ao calcular potencial', mensagem: error instanceof Error ? error.message : 'erro' },
      { status: 500 },
    )
  }
}
