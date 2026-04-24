import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireRole } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/bills/amortize-aporte
 * Body: { amount: number }
 *
 * Cria uma bill payable paga na sub "Aporte sócio > Amortização" com o
 * valor informado. Não mexe nas bills de aporte originais — o saldo
 * devedor é calculado como `aporte pending − amortizações pagas`, então
 * deletar uma amortização volta o saldo automaticamente (reversível).
 */
export async function POST(req: NextRequest) {
  try {
    await requireRole(["OWNER", "ADMIN"])
    const body = await req.json()
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
    }

    const tenantId = await getTenantIdOrDefault()

    const amortizacaoSub = await prisma.billCategory.findFirst({
      where: {
        tenantId,
        type: "payable",
        name: "Amortização",
        parent: { name: "Aporte sócio" },
      },
      select: { id: true },
    })
    if (!amortizacaoSub) {
      return NextResponse.json(
        { error: 'Subcategoria "Aporte sócio > Amortização" não encontrada. Crie em Financeiro > Categorias.' },
        { status: 404 }
      )
    }

    const now = new Date()
    const bill = await prisma.bill.create({
      data: {
        type: "payable",
        description: `Amortização de aporte — ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        amount: Math.round(amount * 100) / 100,
        dueDate: now,
        paidDate: now,
        status: "paid",
        category: "aporte_amortizacao",
        billCategoryId: amortizacaoSub.id,
        quantity: 1,
        tenantId,
      },
    })

    return NextResponse.json({
      ok: true,
      billId: bill.id,
      amount: bill.amount,
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[amortize-aporte]", err)
    return NextResponse.json({ error: "Erro ao amortizar" }, { status: 500 })
  }
}
