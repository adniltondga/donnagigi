import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { REPOSICAO_CATEGORY } from "@/lib/cash-pools"
import { parseStartOfDayBR } from "@/lib/tz"

export const dynamic = "force-dynamic"

/**
 * POST /api/financeiro/reposicao/lancar
 * Body: { amount: number, description?: string, date?: "YYYY-MM-DD" }
 *
 * Cria um Bill payable status=paid category=reposicao_estoque. Atalho do
 * Painel — equivalente a "lançar conta a pagar de reposição já paga"
 * sem precisar passar por categorias e clicar em "Pagar".
 *
 * Para frete/embalagem/contas operacionais, NÃO use este atalho — vai em
 * Contas e use a categoria correta (essas viram despesa no DRE).
 */
export async function POST(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const body = await req.json().catch(() => null)
    const amount = Number(body?.amount)
    const description: string =
      typeof body?.description === "string" && body.description.trim().length > 0
        ? body.description.trim()
        : "Reposição de estoque"
    const dateStr: string | undefined =
      typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : undefined

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
    }

    const date = dateStr ? parseStartOfDayBR(dateStr) : new Date()

    const bill = await prisma.bill.create({
      data: {
        tenantId,
        type: "payable",
        status: "paid",
        category: REPOSICAO_CATEGORY,
        description,
        amount,
        dueDate: date,
        paidDate: date,
      },
      select: { id: true, amount: true, paidDate: true, description: true },
    })

    return NextResponse.json({ ok: true, bill })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[reposicao/lancar]", err)
    return NextResponse.json({ error: "Erro ao registrar reposição" }, { status: 500 })
  }
}
