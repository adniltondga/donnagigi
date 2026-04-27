import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { getMLIntegrationForTenant } from "@/lib/ml"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { fetchActiveListings } from "@/lib/ml-listings"
import { computeSaleNumbers } from "@/lib/sale-notes"
import { parseSaleDescription } from "@/lib/ml-format"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const COVERAGE_DAYS = 30 // sugestão de qty cobre 30 dias de venda

type Status = "ESGOTADO" | "CRITICO" | "ATENCAO" | "OK" | "PARADO"

interface VariationRec {
  variationId: string | null // null quando anúncio não tem variação
  variationName: string | null
  stock: number
  vendas: number
  revenue: number
  velocityPerDay: number
  daysOfStock: number | null // null se velocity = 0
  suggestedQty: number
  status: Status
  productCost: number | null
}

interface ListingRec {
  mlListingId: string
  title: string
  thumbnail: string | null
  hasVariations: boolean
  totalStock: number
  totalVendas: number
  totalRevenue: number
  worstStatus: Status
  variations: VariationRec[]
}

function classifyStatus(stock: number, velocity: number, daysOfStock: number | null): Status {
  if (stock === 0 && velocity > 0) return "ESGOTADO"
  if (stock > 0 && velocity === 0) return "PARADO"
  if (daysOfStock != null && daysOfStock <= 7) return "CRITICO"
  if (daysOfStock != null && daysOfStock <= 14) return "ATENCAO"
  return "OK"
}

const STATUS_RANK: Record<Status, number> = {
  ESGOTADO: 0,
  CRITICO: 1,
  ATENCAO: 2,
  OK: 3,
  PARADO: 4,
}

function worse(a: Status, b: Status): Status {
  return STATUS_RANK[a] <= STATUS_RANK[b] ? a : b
}

function extractListingId(description: string, notes: string | null): string | null {
  const re = /MLB\d{6,}/i
  return description.match(re)?.[0]?.toUpperCase() || notes?.match(re)?.[0]?.toUpperCase() || null
}

/**
 * GET /api/produtos/recomendacoes?windowDays=30
 *
 * Cruza estoque atual do ML (live via /items) com vendas dos últimos
 * windowDays pra gerar lista de recomendações de compra ordenada por
 * urgência. Granularidade por variação quando o anúncio tem.
 */
export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()
    const integration = await getMLIntegrationForTenant(tenantId)
    if (!integration) {
      return NextResponse.json({ erro: "Mercado Livre não conectado" }, { status: 400 })
    }

    const windowDays = Math.max(
      1,
      Math.min(180, Number(req.nextUrl.searchParams.get("windowDays")) || 30)
    )
    const since = new Date()
    since.setDate(since.getDate() - windowDays)

    // 1) Estoque ativo do ML em paralelo com bills
    const [listings, bills] = await Promise.all([
      fetchActiveListings(integration.accessToken, integration.sellerID, tenantId),
      prisma.bill.findMany({
        where: {
          tenantId,
          type: "receivable",
          category: "venda",
          NOT: { status: "cancelled" },
          paidDate: { gte: since },
        },
        select: {
          description: true,
          notes: true,
          mlVariationId: true,
          quantity: true,
          amount: true,
          productCost: true,
        },
      }),
    ])

    // 2) Agrega vendas por (listingId, variationId|"_no_var")
    type SalesAgg = { vendas: number; revenue: number; productCost: number | null }
    const salesByKey = new Map<string, SalesAgg>()
    for (const b of bills) {
      const listingId = extractListingId(b.description, b.notes)
      if (!listingId) continue
      const variationId = b.mlVariationId ?? "_no_var"
      const key = `${listingId}|${variationId}`
      const s = computeSaleNumbers(b)
      const curr = salesByKey.get(key) || { vendas: 0, revenue: 0, productCost: null }
      curr.vendas += b.quantity ?? 1
      curr.revenue += s.bruto
      // productCost mais recente (last write wins, OK pra média)
      if (b.productCost != null) curr.productCost = b.productCost
      salesByKey.set(key, curr)
    }

    // Custos cadastrados (geral por listing + por variação) pra cobrir
    // listings sem venda na janela
    const [listingCosts, variantCosts] = await Promise.all([
      prisma.mLProductCost.findMany({
        where: { tenantId },
        select: { mlListingId: true, productCost: true },
      }),
      prisma.mLProductVariantCost.findMany({
        where: { tenantId },
        select: { mlListingId: true, variationId: true, productCost: true },
      }),
    ])
    const listingCostMap = new Map(listingCosts.map((c) => [c.mlListingId, c.productCost]))
    const variantCostMap = new Map(
      variantCosts.map((c) => [`${c.mlListingId}|${c.variationId}`, c.productCost])
    )

    // 3) Pra cada listing ativo, compõe variations recomendadas
    const items: ListingRec[] = []
    const kpis = { ESGOTADO: 0, CRITICO: 0, ATENCAO: 0, OK: 0, PARADO: 0 } as Record<Status, number>

    for (const lst of listings) {
      const variations: VariationRec[] = []
      const listingFallbackCost = listingCostMap.get(lst.mlListingId) ?? null

      const buildVariation = (
        variationId: string | null,
        variationName: string | null,
        stock: number,
        productCostOverride: number | null
      ): VariationRec => {
        const key = `${lst.mlListingId}|${variationId ?? "_no_var"}`
        const sales = salesByKey.get(key)
        const vendas = sales?.vendas ?? 0
        const revenue = sales?.revenue ?? 0
        const velocityPerDay = vendas / windowDays
        const daysOfStock = velocityPerDay > 0 ? stock / velocityPerDay : null
        const suggestedQty = Math.max(0, Math.ceil(velocityPerDay * COVERAGE_DAYS) - stock)
        const status = classifyStatus(stock, velocityPerDay, daysOfStock)
        kpis[status]++
        const productCost =
          productCostOverride ??
          sales?.productCost ??
          listingFallbackCost
        return {
          variationId,
          variationName,
          stock,
          vendas,
          revenue,
          velocityPerDay,
          daysOfStock,
          suggestedQty,
          status,
          productCost,
        }
      }

      if (lst.hasVariations) {
        for (const [vid, qty] of Object.entries(lst.byVariation)) {
          let name = lst.variationNames[vid] ?? null
          // Fallback: se o ML não devolveu o nome, tenta extrair de uma venda dessa variação
          if (!name) {
            for (const b of bills) {
              if (b.mlVariationId !== vid) continue
              const lid = extractListingId(b.description, b.notes)
              if (lid !== lst.mlListingId) continue
              const parsed = parseSaleDescription(b.description)
              if (parsed.variation) {
                name = parsed.variation
                break
              }
            }
          }
          const cost = variantCostMap.get(`${lst.mlListingId}|${vid}`) ?? null
          variations.push(buildVariation(vid, name, qty, cost))
        }
      } else {
        variations.push(buildVariation(null, null, lst.stock, null))
      }

      // Status do anúncio = pior das variações
      const worstStatus = variations.reduce<Status>(
        (acc, v) => worse(acc, v.status),
        "OK"
      )
      const totalVendas = variations.reduce((s, v) => s + v.vendas, 0)
      const totalRevenue = variations.reduce((s, v) => s + v.revenue, 0)
      const totalStock = variations.reduce((s, v) => s + v.stock, 0)

      items.push({
        mlListingId: lst.mlListingId,
        title: lst.title,
        thumbnail: lst.thumbnail,
        hasVariations: lst.hasVariations,
        totalStock,
        totalVendas,
        totalRevenue,
        worstStatus,
        variations,
      })
    }

    // 4) Ordena por urgência: pior status primeiro; dentro do status,
    // mais faturamento primeiro (priorizar bons sellers em apuro)
    items.sort((a, b) => {
      if (a.worstStatus !== b.worstStatus) {
        return STATUS_RANK[a.worstStatus] - STATUS_RANK[b.worstStatus]
      }
      return b.totalRevenue - a.totalRevenue
    })

    return NextResponse.json({
      windowDays,
      coverageDays: COVERAGE_DAYS,
      items,
      kpis,
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[produtos/recomendacoes]", err)
    return NextResponse.json({ erro: "Erro ao gerar recomendações" }, { status: 500 })
  }
}
