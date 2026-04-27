import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { parseSaleDescription } from "@/lib/ml-format"

export const dynamic = "force-dynamic"

interface RefundItem {
  id: string
  amount: number
  costRefunded: number | null
  refundedAt: string
  source: string
  reason: string | null
  mlOrderId: string | null
  bill: {
    id: string
    title: string
    variation: string | null
    mlListingId: string | null
    amount: number
    productCost: number | null
    paidDate: string | null
  }
}

interface DevolucoesResponse {
  items: RefundItem[]
  total: number
  totalAmount: number
  totalCostRefunded: number
  period: { start: string; end: string }
}

/**
 * GET /api/financeiro/devolucoes?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Lista devoluções (BillRefund) com a venda original anexada.
 * Default: mês corrente.
 */
export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const sp = req.nextUrl.searchParams
    const startStr = sp.get("start")
    const endStr = sp.get("end")
    const now = new Date()
    const start = startStr
      ? new Date(`${startStr}T00:00:00`)
      : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const end = endStr
      ? new Date(`${endStr}T00:00:00`)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)

    const refunds = await prisma.billRefund.findMany({
      where: {
        tenantId,
        refundedAt: { gte: start, lt: end },
      },
      orderBy: { refundedAt: "desc" },
      include: {
        bill: {
          select: {
            id: true,
            description: true,
            notes: true,
            amount: true,
            productCost: true,
            paidDate: true,
          },
        },
      },
    })

    const items: RefundItem[] = refunds.map((r) => {
      const parsed = parseSaleDescription(r.bill.description ?? "")
      return {
        id: r.id,
        amount: r.amount,
        costRefunded: r.costRefunded,
        refundedAt: r.refundedAt.toISOString(),
        source: r.source,
        reason: r.reason,
        mlOrderId: r.mlOrderId,
        bill: {
          id: r.bill.id,
          title: parsed.title,
          variation: parsed.variation,
          mlListingId: parsed.mlListingId,
          amount: r.bill.amount,
          productCost: r.bill.productCost,
          paidDate: r.bill.paidDate ? r.bill.paidDate.toISOString() : null,
        },
      }
    })

    const totalAmount = items.reduce((s, x) => s + x.amount, 0)
    const totalCostRefunded = items.reduce((s, x) => s + (x.costRefunded ?? 0), 0)

    const res: DevolucoesResponse = {
      items,
      total: items.length,
      totalAmount,
      totalCostRefunded,
      period: { start: start.toISOString(), end: end.toISOString() },
    }
    return NextResponse.json(res)
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[devolucoes GET]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
