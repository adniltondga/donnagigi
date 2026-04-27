import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { parseStartOfDayBR, parseEndOfDayBR } from "@/lib/tz"

export const dynamic = "force-dynamic"

/**
 * GET /api/relatorios/livro-caixa?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Lista cronológica de movimentos de caixa (bills pagas/recebidas no
 * período), ordenadas por data. Estrutura pra lançamento contábil.
 *
 * Cada linha:
 *   date, historico, categoria, entrada, saida, saldo
 *
 * O "saldo" começa em 0 e acumula linha a linha. Se quiser saldo inicial
 * real, preencha em Configurações > saldoCaixaAtual (não faz parte do livro).
 */
export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const fromStr = req.nextUrl.searchParams.get("from")
    const toStr = req.nextUrl.searchParams.get("to")
    const today = new Date()
    const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1)
    const defaultTo = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    const from =
      fromStr && /^\d{4}-\d{2}-\d{2}$/.test(fromStr)
        ? parseStartOfDayBR(fromStr)
        : defaultFrom
    const to =
      toStr && /^\d{4}-\d{2}-\d{2}$/.test(toStr)
        ? parseEndOfDayBR(toStr)
        : defaultTo

    // Bills pagas/recebidas no período (usa paidDate como data efetiva)
    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        status: "paid",
        paidDate: { gte: from, lte: to },
      },
      include: {
        billCategory: { include: { parent: true } },
        supplier: true,
      },
      orderBy: { paidDate: "asc" },
    })

    let saldo = 0
    const linhas = bills.map((b) => {
      const entrada = b.type === "receivable" ? b.amount : 0
      const saida = b.type === "payable" ? b.amount : 0
      saldo += entrada - saida
      const cat = b.billCategory
        ? b.billCategory.parent
          ? `${b.billCategory.parent.name} · ${b.billCategory.name}`
          : b.billCategory.name
        : b.category || "—"
      return {
        id: b.id,
        date: b.paidDate?.toISOString().slice(0, 10) ?? "",
        historico: b.description,
        categoria: cat,
        supplier: b.supplier?.name ?? null,
        type: b.type,
        entrada: Math.round(entrada * 100) / 100,
        saida: Math.round(saida * 100) / 100,
        saldo: Math.round(saldo * 100) / 100,
      }
    })

    const totalEntradas = linhas.reduce((s, l) => s + l.entrada, 0)
    const totalSaidas = linhas.reduce((s, l) => s + l.saida, 0)

    return NextResponse.json({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      linhas,
      resumo: {
        totalEntradas: Math.round(totalEntradas * 100) / 100,
        totalSaidas: Math.round(totalSaidas * 100) / 100,
        saldoPeriodo: Math.round((totalEntradas - totalSaidas) * 100) / 100,
        count: linhas.length,
      },
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[livro-caixa]", err)
    return NextResponse.json({ error: "Erro ao gerar livro caixa" }, { status: 500 })
  }
}
