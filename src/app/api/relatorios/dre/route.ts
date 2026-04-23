import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/relatorios/dre?month=YYYY-MM
 *
 * DRE simplificada (regime de caixa) do mês informado + comparativo vs
 * mês anterior.
 *
 * Fontes:
 *  - Vendas ML: Bill.category='venda' + type='receivable', status != cancelled,
 *    filtrado por paidDate no mês.
 *    • amount = líquido (já vem descontado das taxas no sync)
 *    • notes contém "Bruto:", "Taxa de venda:", "Taxa de envio:" pra extrair
 *    • productCost = CMV do pedido
 *  - Outras receitas: Bill.type='receivable', category != 'venda', paidDate no mês
 *  - Despesas operacionais: Bill.type='payable', category != 'marketplace_fee',
 *    paidDate no mês (só pagas de fato). Agrupadas por billCategory raiz.
 */
export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const monthParam = req.nextUrl.searchParams.get("month") // formato "YYYY-MM"
    const today = new Date()
    let year: number, month0: number // month0: 0-11
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      year = Number(monthParam.slice(0, 4))
      month0 = Number(monthParam.slice(5, 7)) - 1
    } else {
      year = today.getFullYear()
      month0 = today.getMonth()
    }

    const currentDre = await computeDre(tenantId, year, month0)
    const prevMonth0 = month0 === 0 ? 11 : month0 - 1
    const prevYear = month0 === 0 ? year - 1 : year
    const previousDre = await computeDre(tenantId, prevYear, prevMonth0)

    return NextResponse.json({
      month: `${year}-${String(month0 + 1).padStart(2, "0")}`,
      previousMonth: `${prevYear}-${String(prevMonth0 + 1).padStart(2, "0")}`,
      current: currentDre,
      previous: previousDre,
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[dre]", err)
    return NextResponse.json({ error: "Erro ao calcular DRE" }, { status: 500 })
  }
}

interface DespesaCategoria {
  name: string
  total: number
}

interface DreResult {
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

function parseAmount(notes: string | null, re: RegExp): number {
  if (!notes) return 0
  const m = notes.match(re)
  if (!m) return 0
  return Number(m[1].replace(/\./g, "").replace(",", ".")) || 0
}

async function computeDre(tenantId: string, year: number, month0: number): Promise<DreResult> {
  const start = new Date(year, month0, 1, 0, 0, 0, 0)
  const end = new Date(year, month0 + 1, 1, 0, 0, 0, 0)

  // Vendas ML — usa paidDate (data que o ML fechou o pedido)
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
    const bruto = parseAmount(v.notes, /Bruto:\s*R\$\s*([\d,.]+)/)
    const tv = parseAmount(v.notes, /Taxa de venda:\s*R\$\s*([\d,.]+)/)
    const te = parseAmount(v.notes, /Taxa de envio:\s*R\$\s*([\d,.]+)/)
    // Se bruto não vier no notes, reconstrói: amount (líquido) + taxas
    const brutoReal = bruto > 0 ? bruto : v.amount + tv + te
    receitaBrutaML += brutoReal
    taxaVendaML += tv
    taxaEnvioML += te
    if (v.productCost) cmv += v.productCost
  }

  // Outras receitas (bills receivable que não são vendas ML) — paidDate no mês
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

  // Despesas operacionais pagas no período — paidDate no mês, excluindo taxas ML
  // (já contabilizadas acima) e vendas
  const despesas = await prisma.bill.findMany({
    where: {
      tenantId,
      type: "payable",
      status: "paid",
      paidDate: { gte: start, lt: end },
      NOT: [{ category: "marketplace_fee" }, { category: "venda" }],
    },
    select: {
      amount: true,
      category: true,
      billCategory: { select: { name: true, parent: { select: { name: true } } } },
    },
  })

  const catMap = new Map<string, number>()
  for (const d of despesas) {
    // Agrupa pela categoria raiz (se tiver billCategory), senão pela string legacy
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
