import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { REPOSICAO_CATEGORY } from "@/lib/cash-pools"

export const dynamic = "force-dynamic"

/**
 * GET /api/financeiro/reposicao/list
 *
 * Lista paginada das bills de reposição (category=reposicao_estoque, paid).
 *
 * Query:
 *  - page (default 1)
 *  - pageSize (default 20, max 100)
 *  - ym (YYYY-MM) opcional, filtra por mês do paidDate
 *  - q opcional, busca por descrição (case-insensitive)
 */
export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get("page") || 1))
    const pageSize = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("pageSize") || 20)),
    )
    const ym = url.searchParams.get("ym")
    const q = url.searchParams.get("q")?.trim() || undefined

    const where: Prisma.BillWhereInput = {
      tenantId,
      type: "payable",
      category: REPOSICAO_CATEGORY,
      status: "paid",
      paidDate: { not: null },
    }

    if (ym && /^\d{4}-\d{2}$/.test(ym)) {
      const [y, m] = ym.split("-").map(Number)
      const from = new Date(y, m - 1, 1)
      const to = new Date(y, m, 1)
      where.paidDate = { gte: from, lt: to }
    }

    if (q) {
      where.description = { contains: q, mode: "insensitive" }
    }

    const [items, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        orderBy: { paidDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          amount: true,
          description: true,
          paidDate: true,
          dueDate: true,
        },
      }),
      prisma.bill.count({ where }),
    ])

    return NextResponse.json({
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items: items.map((it) => ({
        id: it.id,
        amount: Math.round(it.amount * 100) / 100,
        description: it.description,
        paidDate: it.paidDate ? it.paidDate.toISOString() : null,
        dueDate: it.dueDate.toISOString(),
      })),
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[reposicao/list]", err)
    return NextResponse.json({ error: "Erro ao listar" }, { status: 500 })
  }
}
