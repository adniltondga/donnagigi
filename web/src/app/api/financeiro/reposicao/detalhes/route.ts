import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { REPOSICAO_CATEGORY } from "@/lib/cash-pools"
import { computeSaleNumbers } from "@/lib/sale-notes"
import { getPartialRefundsForBills, refundOf } from "@/lib/refunds"

export const dynamic = "force-dynamic"

/**
 * GET /api/financeiro/reposicao/detalhes
 *
 * Drilldown do card "A repor de mercadoria" — agregação mensal LIFETIME.
 * Mesmo critério do DRE (lib/dre.ts) pra os números BATEREM:
 *  - vendas: type=receivable, category=venda, NOT cancelled, paidDate setado
 *  - CMV usa computeSaleNumbers + costRefunded (refund parcial reduz CMV)
 *  - receita bruta = bruto da venda × (1 − refundRatio)
 *  - reposições: payable, category=reposicao_estoque, status=paid, paidDate setado
 *
 * Critério de mês: paidDate (caixa real). Bills sem paidDate são ignoradas.
 */
export async function GET() {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const [vendas, reposicoes] = await Promise.all([
      prisma.bill.findMany({
        where: {
          tenantId,
          type: "receivable",
          category: "venda",
          NOT: { status: "cancelled" },
          paidDate: { not: null },
        },
        select: {
          id: true,
          paidDate: true,
          amount: true,
          notes: true,
          productCost: true,
        },
      }),
      prisma.bill.findMany({
        where: {
          tenantId,
          type: "payable",
          category: REPOSICAO_CATEGORY,
          status: "paid",
          paidDate: { not: null },
        },
        select: { paidDate: true, amount: true },
      }),
    ])

    const refundMap = await getPartialRefundsForBills(
      tenantId,
      vendas.map((v) => v.id),
    )

    const ymOf = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`

    const map = new Map<
      string,
      {
        vendaBruta: number
        cmv: number
        reposto: number
        vendasCount: number
        vendasSemCusto: number
        reposicoesCount: number
      }
    >()
    const ensure = (ym: string) => {
      let cur = map.get(ym)
      if (!cur) {
        cur = {
          vendaBruta: 0,
          cmv: 0,
          reposto: 0,
          vendasCount: 0,
          vendasSemCusto: 0,
          reposicoesCount: 0,
        }
        map.set(ym, cur)
      }
      return cur
    }

    let vendaBrutaTotal = 0
    let cmvTotal = 0
    let vendasSemCustoTotal = 0

    for (const v of vendas) {
      if (!v.paidDate) continue
      const cur = ensure(ymOf(v.paidDate))
      const s = computeSaleNumbers(v)
      const refund = refundOf(refundMap, v.id)
      const refundRatio = v.amount > 0 ? refund.amount / v.amount : 0
      const brutoEfetivo = s.bruto * (1 - refundRatio)
      const cmvEfetivo = Math.max(0, s.custo - refund.costRefunded)

      cur.vendaBruta += brutoEfetivo
      cur.cmv += cmvEfetivo
      cur.vendasCount += 1
      if (v.productCost == null) {
        cur.vendasSemCusto += 1
        vendasSemCustoTotal += 1
      }

      vendaBrutaTotal += brutoEfetivo
      cmvTotal += cmvEfetivo
    }

    let repostoTotal = 0
    for (const r of reposicoes) {
      if (!r.paidDate) continue
      const cur = ensure(ymOf(r.paidDate))
      cur.reposto += r.amount
      cur.reposicoesCount += 1
      repostoTotal += r.amount
    }

    const meses = Array.from(map.entries())
      .map(([ym, v]) => ({
        ym,
        vendaBruta: Math.round(v.vendaBruta * 100) / 100,
        cmv: Math.round(v.cmv * 100) / 100,
        reposto: Math.round(v.reposto * 100) / 100,
        saldo: Math.round((v.cmv - v.reposto) * 100) / 100,
        vendasCount: v.vendasCount,
        vendasSemCusto: v.vendasSemCusto,
        reposicoesCount: v.reposicoesCount,
      }))
      .sort((a, b) => b.ym.localeCompare(a.ym))

    return NextResponse.json({
      vendaBrutaTotal: Math.round(vendaBrutaTotal * 100) / 100,
      cmvTotal: Math.round(cmvTotal * 100) / 100,
      repostoTotal: Math.round(repostoTotal * 100) / 100,
      saldoTotal: Math.round((cmvTotal - repostoTotal) * 100) / 100,
      vendasSemCusto: vendasSemCustoTotal,
      meses,
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[reposicao/detalhes]", err)
    return NextResponse.json({ error: "Erro ao carregar detalhes" }, { status: 500 })
  }
}
