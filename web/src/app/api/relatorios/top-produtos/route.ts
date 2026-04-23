import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/relatorios/top-produtos?direction=mais|menos&limit=N
 *
 * Agrega vendas ML por anúncio+variação e retorna ranking. Ordem:
 * - direction=mais (default): mais vendidos primeiro (quantidade desc)
 * - direction=menos: menos vendidos primeiro (quantidade asc)
 *
 * Exclui bills canceladas. Rank baseado em quantidade total de unidades.
 */
export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const direction = req.nextUrl.searchParams.get("direction") === "menos" ? "asc" : "desc"
    const limitParam = Number(req.nextUrl.searchParams.get("limit")) || 50
    const limit = Math.min(Math.max(limitParam, 1), 200)

    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        category: "venda",
        type: "receivable",
        NOT: { status: "cancelled" },
      },
      select: {
        description: true,
        notes: true,
        amount: true,
        paidDate: true,
        productCost: true,
        quantity: true,
      },
    })

    const re = /MLB\d{6,}/i
    const agg = new Map<
      string,
      {
        listingId: string
        title: string
        variation: string | null
        vendas: number
        unidades: number
        totalBruto: number
        totalLucroComCusto: number // só soma quando tem productCost; fica null no return se 0 bills com custo
        pedidosComCusto: number
        ultimaVenda: Date | null
      }
    >()

    for (const b of bills) {
      const listingId =
        b.description.match(re)?.[0]?.toUpperCase() ||
        b.notes?.match(re)?.[0]?.toUpperCase()
      if (!listingId) continue

      // Extrai "<title> · <variacao>" da description
      // Formato: "Venda ML - <title>[ · <var>] [Produto ML: MLB...]"
      const titleMatch = /Venda ML - (.+?)\s*\[Produto ML:/.exec(b.description)
      const fullTitle = (titleMatch?.[1] || "").trim()
      const parts = fullTitle.split(" · ")
      const title = parts[0] || fullTitle
      const variation = parts.length > 1 ? parts.slice(1).join(" · ") : null

      const key = variation ? `${listingId}|${variation}` : listingId
      const cur =
        agg.get(key) ||
        {
          listingId,
          title,
          variation,
          vendas: 0,
          unidades: 0,
          totalBruto: 0,
          totalLucroComCusto: 0,
          pedidosComCusto: 0,
          ultimaVenda: null as Date | null,
        }

      cur.vendas += 1
      cur.unidades += b.quantity || 1
      cur.totalBruto += b.amount
      if (b.productCost != null) {
        cur.totalLucroComCusto += b.amount - b.productCost
        cur.pedidosComCusto += 1
      }
      if (b.paidDate && (!cur.ultimaVenda || b.paidDate > cur.ultimaVenda)) {
        cur.ultimaVenda = b.paidDate
      }
      agg.set(key, cur)
    }

    const items = Array.from(agg.values())
      .map((v) => ({
        listingId: v.listingId,
        title: v.title,
        variation: v.variation,
        vendas: v.vendas,
        unidades: v.unidades,
        totalBruto: v.totalBruto,
        lucroEstimado: v.pedidosComCusto > 0 ? v.totalLucroComCusto : null,
        ultimaVenda: v.ultimaVenda,
      }))
      .sort((a, b) => {
        const diff = direction === "desc" ? b.unidades - a.unidades : a.unidades - b.unidades
        if (diff !== 0) return diff
        // desempate: mais recente primeiro
        const ta = a.ultimaVenda ? a.ultimaVenda.getTime() : 0
        const tb = b.ultimaVenda ? b.ultimaVenda.getTime() : 0
        return tb - ta
      })
      .slice(0, limit)

    return NextResponse.json({ items, total: agg.size })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[top-produtos]", err)
    return NextResponse.json({ error: "Erro ao calcular ranking" }, { status: 500 })
  }
}
