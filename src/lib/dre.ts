import prisma from "@/lib/prisma"
import { computeSaleNumbers } from "@/lib/sale-notes"

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
    select: { amount: true, notes: true, productCost: true, quantity: true },
  })

  let receitaBrutaML = 0
  let taxaVendaML = 0
  let taxaEnvioML = 0
  let cmv = 0
  for (const v of vendas) {
    const s = computeSaleNumbers(v)
    receitaBrutaML += s.bruto
    taxaVendaML += s.taxaVenda
    taxaEnvioML += s.envio
    cmv += s.custo
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

  const despesasWhere =
    basis === "caixa"
      ? {
          tenantId,
          type: "payable",
          status: "paid",
          paidDate: { gte: start, lt: end },
          NOT: [{ category: "marketplace_fee" }, { category: "venda" }],
        }
      : {
          tenantId,
          type: "payable",
          NOT: [
            { category: "marketplace_fee" },
            { category: "venda" },
            { status: "cancelled" },
          ],
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
