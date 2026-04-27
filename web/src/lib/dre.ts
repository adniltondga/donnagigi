import prisma from "@/lib/prisma"
import { computeSaleNumbers } from "@/lib/sale-notes"
import { getPartialRefundsForBills, refundOf } from "@/lib/refunds"

export interface DespesaCategoria {
  name: string
  total: number
}

export interface DreResult {
  receitaBrutaML: number
  receitaBrutaOutras: number
  receitaBruta: number
  taxaVendaML: number
  taxaEnvioML: number
  totalTaxas: number
  receitaLiquida: number
  cmv: number
  lucroBruto: number
  despesasPorCategoria: DespesaCategoria[]
  totalDespesas: number
  lucroLiquido: number
  margemLiquidaPct: number
}

export type DreBasis = "caixa" | "competencia"

export async function computeDre(
  tenantId: string,
  year: number,
  month0: number,
  basis: DreBasis
): Promise<DreResult> {
  const start = new Date(year, month0, 1, 0, 0, 0, 0)
  const end = new Date(year, month0 + 1, 1, 0, 0, 0, 0)

  const vendas = await prisma.bill.findMany({
    where: {
      tenantId,
      category: "venda",
      type: "receivable",
      NOT: { status: "cancelled" },
      paidDate: { gte: start, lt: end },
    },
    select: { id: true, amount: true, notes: true, productCost: true, quantity: true },
  })

  // Refunds parciais subtraem do bruto (proporcionalmente, via amount líquido)
  // e do CMV (via costRefunded). Refunds totais já saíram pelo filtro cancelled.
  const refundMap = await getPartialRefundsForBills(
    tenantId,
    vendas.map((v) => v.id),
  )

  let receitaBrutaML = 0
  let taxaVendaML = 0
  let taxaEnvioML = 0
  let cmv = 0
  for (const v of vendas) {
    const s = computeSaleNumbers(v)
    const refund = refundOf(refundMap, v.id)
    // refund.amount é líquido (mesma escala de bill.amount). Pra abater do
    // bruto, escalo proporcionalmente: brutoRefundado = bruto × (refund/amount).
    const refundRatio = v.amount > 0 ? refund.amount / v.amount : 0
    receitaBrutaML += s.bruto * (1 - refundRatio)
    taxaVendaML += s.taxaVenda * (1 - refundRatio)
    taxaEnvioML += s.envio * (1 - refundRatio)
    cmv += Math.max(0, s.custo - refund.costRefunded)
  }

  const outras = await prisma.bill.findMany({
    where: {
      tenantId,
      type: "receivable",
      NOT: [{ category: "venda" }, { status: "cancelled" }],
      paidDate: { gte: start, lt: end },
    },
    select: { amount: true },
  })
  const receitaBrutaOutras = outras.reduce((s, b) => s + b.amount, 0)

  // "Aporte sócio" (raiz + filhas, incluindo Amortização) NÃO entra no DRE.
  // Aporte é capital (entrada de caixa do sócio); amortização é devolução
  // de capital. Ambos são movimentação do balanço (passivo "Conta-corrente
  // sócios"), não receita/despesa operacional. Pelo padrão contábil, só
  // pró-labore (sócio-administrador) entra como despesa de Pessoal — o
  // que já acontece via categoria "Pessoal > Pró-labore".
  const aporteRoot = await prisma.billCategory.findFirst({
    where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
    select: { id: true, children: { select: { id: true } } },
  })
  const aporteIds = aporteRoot
    ? [aporteRoot.id, ...aporteRoot.children.map((c) => c.id)]
    : []

  // Reposição de estoque NÃO entra em despesas operacionais — vai pra
  // o "Caixa de Reposição" (ver lib/cash-pools.ts). Se entrasse aqui,
  // duplicaria o custo do produto (CMV + reposição).
  const despesasWhere =
    basis === "caixa"
      ? {
          tenantId,
          type: "payable",
          status: "paid",
          paidDate: { gte: start, lt: end },
          NOT: [
            { category: "marketplace_fee" },
            { category: "venda" },
            { category: "aporte_amortizacao" },
            { category: "reposicao_estoque" },
          ],
          ...(aporteIds.length > 0 ? { billCategoryId: { notIn: aporteIds } } : {}),
        }
      : {
          tenantId,
          type: "payable",
          NOT: [
            { category: "marketplace_fee" },
            { category: "venda" },
            { category: "aporte_amortizacao" },
            { category: "reposicao_estoque" },
            { status: "cancelled" },
          ],
          ...(aporteIds.length > 0 ? { billCategoryId: { notIn: aporteIds } } : {}),
          dueDate: { gte: start, lt: end },
        }
  const despesas = await prisma.bill.findMany({
    where: despesasWhere,
    select: {
      amount: true,
      category: true,
      billCategory: { select: { name: true, parent: { select: { name: true } } } },
    },
  })

  const catMap = new Map<string, number>()
  for (const d of despesas) {
    const rootName =
      d.billCategory?.parent?.name || d.billCategory?.name || d.category || "Outros"
    catMap.set(rootName, (catMap.get(rootName) || 0) + d.amount)
  }
  const despesasPorCategoria = Array.from(catMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
  const totalDespesas = despesasPorCategoria.reduce((s, x) => s + x.total, 0)

  const receitaBruta = receitaBrutaML + receitaBrutaOutras
  const totalTaxas = taxaVendaML + taxaEnvioML
  const receitaLiquida = receitaBruta - totalTaxas
  const lucroBruto = receitaLiquida - cmv
  const lucroLiquido = lucroBruto - totalDespesas
  const margemLiquidaPct = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0

  return {
    receitaBrutaML,
    receitaBrutaOutras,
    receitaBruta,
    taxaVendaML,
    taxaEnvioML,
    totalTaxas,
    receitaLiquida,
    cmv,
    lucroBruto,
    despesasPorCategoria,
    totalDespesas,
    lucroLiquido,
    margemLiquidaPct,
  }
}

export function sumDreResults(results: DreResult[]): DreResult {
  const catMap = new Map<string, number>()
  let receitaBrutaML = 0
  let receitaBrutaOutras = 0
  let taxaVendaML = 0
  let taxaEnvioML = 0
  let cmv = 0
  for (const r of results) {
    receitaBrutaML += r.receitaBrutaML
    receitaBrutaOutras += r.receitaBrutaOutras
    taxaVendaML += r.taxaVendaML
    taxaEnvioML += r.taxaEnvioML
    cmv += r.cmv
    for (const c of r.despesasPorCategoria) {
      catMap.set(c.name, (catMap.get(c.name) || 0) + c.total)
    }
  }
  const despesasPorCategoria = Array.from(catMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
  const totalDespesas = despesasPorCategoria.reduce((s, x) => s + x.total, 0)
  const receitaBruta = receitaBrutaML + receitaBrutaOutras
  const totalTaxas = taxaVendaML + taxaEnvioML
  const receitaLiquida = receitaBruta - totalTaxas
  const lucroBruto = receitaLiquida - cmv
  const lucroLiquido = lucroBruto - totalDespesas
  const margemLiquidaPct = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0
  return {
    receitaBrutaML,
    receitaBrutaOutras,
    receitaBruta,
    taxaVendaML,
    taxaEnvioML,
    totalTaxas,
    receitaLiquida,
    cmv,
    lucroBruto,
    despesasPorCategoria,
    totalDespesas,
    lucroLiquido,
    margemLiquidaPct,
  }
}
