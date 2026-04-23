import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/relatorios/despesas-categoria?month=YYYY-MM&basis=paid|due
 *
 * Agrupa bills payable (exclui taxas ML e vendas) pelo par categoria+subcategoria.
 * basis=paid → considera bills com status=paid e paidDate no mês (default)
 * basis=due  → considera bills com dueDate no mês, independente do status
 */
export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const monthParam = req.nextUrl.searchParams.get("month")
    const basis = req.nextUrl.searchParams.get("basis") === "due" ? "due" : "paid"
    const today = new Date()
    let year: number, month0: number
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      year = Number(monthParam.slice(0, 4))
      month0 = Number(monthParam.slice(5, 7)) - 1
    } else {
      year = today.getFullYear()
      month0 = today.getMonth()
    }
    const start = new Date(year, month0, 1, 0, 0, 0, 0)
    const end = new Date(year, month0 + 1, 1, 0, 0, 0, 0)

    const where: {
      tenantId: string
      type: string
      NOT: Array<{ category?: string; status?: string }>
      paidDate?: { gte: Date; lt: Date }
      status?: string
      dueDate?: { gte: Date; lt: Date }
    } = {
      tenantId,
      type: "payable",
      NOT: [{ category: "marketplace_fee" }, { category: "venda" }, { status: "cancelled" }],
    }
    if (basis === "paid") {
      where.status = "paid"
      where.paidDate = { gte: start, lt: end }
    } else {
      where.dueDate = { gte: start, lt: end }
    }

    const bills = await prisma.bill.findMany({
      where,
      select: {
        amount: true,
        category: true,
        billCategory: {
          select: {
            id: true,
            name: true,
            parent: { select: { id: true, name: true } },
          },
        },
      },
    })

    interface SubAgg {
      id: string | null
      name: string
      total: number
      count: number
    }
    interface RootAgg {
      id: string | null
      name: string
      total: number
      count: number
      subs: Map<string, SubAgg>
    }
    const roots = new Map<string, RootAgg>()

    for (const b of bills) {
      const rootName = b.billCategory?.parent?.name || b.billCategory?.name || b.category || "Outros"
      const rootId = b.billCategory?.parent?.id || b.billCategory?.id || null
      const subName = b.billCategory?.parent ? b.billCategory.name : "—"
      const subId = b.billCategory?.parent ? b.billCategory.id : null

      const rootKey = rootId ?? `legacy:${rootName}`
      const subKey = subId ?? `legacy:${subName}`

      let root = roots.get(rootKey)
      if (!root) {
        root = { id: rootId, name: rootName, total: 0, count: 0, subs: new Map() }
        roots.set(rootKey, root)
      }
      root.total += b.amount
      root.count += 1

      let sub = root.subs.get(subKey)
      if (!sub) {
        sub = { id: subId, name: subName, total: 0, count: 0 }
        root.subs.set(subKey, sub)
      }
      sub.total += b.amount
      sub.count += 1
    }

    const total = Array.from(roots.values()).reduce((s, r) => s + r.total, 0)
    const items = Array.from(roots.values())
      .map((r) => ({
        id: r.id,
        name: r.name,
        total: r.total,
        count: r.count,
        pct: total > 0 ? (r.total / total) * 100 : 0,
        subs: Array.from(r.subs.values())
          .map((s) => ({ ...s, pct: total > 0 ? (s.total / total) * 100 : 0 }))
          .sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total)

    return NextResponse.json({
      month: `${year}-${String(month0 + 1).padStart(2, "0")}`,
      basis,
      total,
      items,
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[despesas-categoria]", err)
    return NextResponse.json({ error: "Erro ao calcular despesas" }, { status: 500 })
  }
}
