import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/relatorios/balancete?month=YYYY-MM
 *
 * Balancete gerencial — 3 blocos:
 *  - Resultado do mês (DRE resumida, com CMV baseado em max(productCost, aporte mercadoria))
 *  - Movimento de caixa (entradas/saídas efetivas no período)
 *  - Posição patrimonial (saldos no fim do mês: aportes a devolver, MP a liberar, YTD)
 */
export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const monthParam = req.nextUrl.searchParams.get("month")
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
    const startYear = new Date(year, 0, 1, 0, 0, 0, 0)

    // --- IDs de categorias Aporte ---
    const aporteRoot = await prisma.billCategory.findFirst({
      where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
      select: { id: true, children: { select: { id: true, name: true } } },
    })
    const amortizacaoSubId = aporteRoot?.children.find((c) => c.name === "Amortização")?.id ?? null
    const aporteMercadoriaSubId = aporteRoot?.children.find((c) => c.name === "Mercadoria")?.id ?? null
    const aporteOriginalIds = aporteRoot
      ? [aporteRoot.id, ...aporteRoot.children.filter((c) => c.name !== "Amortização").map((c) => c.id)]
      : []
    const aporteOperacionalIds = aporteRoot
      ? [
          aporteRoot.id,
          ...aporteRoot.children
            .filter((c) => c.name !== "Amortização" && c.name !== "Mercadoria")
            .map((c) => c.id),
        ]
      : []
    const proLaboreSub = await prisma.billCategory.findFirst({
      where: { tenantId, type: "payable", name: "Pró-labore", parent: { name: "Pessoal" } },
      select: { id: true },
    })

    /* =========================================================
       BLOCO 1: RESULTADO DO MÊS (competência)
       ========================================================= */
    const receitas = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "receivable",
        NOT: { status: "cancelled" },
        paidDate: { gte: start, lt: end },
      },
      select: { amount: true, productCost: true },
    })
    const receitaBruta = receitas.reduce((s, b) => s + b.amount, 0)
    const cmvCadastrado = receitas.reduce((s, b) => s + (b.productCost || 0), 0)

    const aportesMercadoriaBills = aporteMercadoriaSubId
      ? await prisma.bill.findMany({
          where: {
            tenantId,
            type: "payable",
            billCategoryId: aporteMercadoriaSubId,
            NOT: { status: "cancelled" },
            dueDate: { gte: start, lt: end },
          },
          select: { amount: true },
        })
      : []
    const aporteMercadoriaNoMes = aportesMercadoriaBills.reduce((s, b) => s + b.amount, 0)
    const cmvDoMes = Math.max(cmvCadastrado, aporteMercadoriaNoMes)
    const receitaLiquida = receitaBruta - cmvDoMes

    const despesasPagas = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        status: "paid",
        paidDate: { gte: start, lt: end },
        category: { not: "reposicao_estoque" },
        NOT: [
          { billCategoryId: { in: aporteOriginalIds.length > 0 ? aporteOriginalIds : ["__none__"] } },
          ...(proLaboreSub ? [{ billCategoryId: proLaboreSub.id }] : []),
        ],
      },
      select: { amount: true },
    })
    const despesasTotal = despesasPagas.reduce((s, b) => s + b.amount, 0)

    const aportesOperacionaisBills =
      aporteOperacionalIds.length > 0
        ? await prisma.bill.findMany({
            where: {
              tenantId,
              type: "payable",
              billCategoryId: { in: aporteOperacionalIds },
              NOT: { status: "cancelled" },
              dueDate: { gte: start, lt: end },
            },
            select: { amount: true },
          })
        : []
    const aportesOperacionaisTotal = aportesOperacionaisBills.reduce((s, b) => s + b.amount, 0)

    const lucroLiquido = receitaLiquida - despesasTotal - aportesOperacionaisTotal

    /* =========================================================
       BLOCO 2: MOVIMENTO DE CAIXA
       ========================================================= */
    // Entradas: bills receivable paid no mês (inclui ML)
    const entradasBills = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "receivable",
        NOT: { status: "cancelled" },
        paidDate: { gte: start, lt: end },
      },
      select: { amount: true },
    })
    const entradasTotal = entradasBills.reduce((s, b) => s + b.amount, 0)

    // Saídas: bills payable paid no mês (tudo que saiu do caixa)
    const saidasBills = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        status: "paid",
        paidDate: { gte: start, lt: end },
      },
      select: {
        amount: true,
        billCategoryId: true,
      },
    })
    const saidasTotal = saidasBills.reduce((s, b) => s + b.amount, 0)
    const saidasAmortizacao = saidasBills
      .filter((b) => b.billCategoryId === amortizacaoSubId)
      .reduce((s, b) => s + b.amount, 0)
    const saidasProLabore = saidasBills
      .filter((b) => proLaboreSub && b.billCategoryId === proLaboreSub.id)
      .reduce((s, b) => s + b.amount, 0)
    const saidasOperacionais = saidasTotal - saidasAmortizacao - saidasProLabore

    /* =========================================================
       BLOCO 3: POSIÇÃO (ao fim do mês)
       ========================================================= */
    // Aportes pendentes (dívida com sócio)
    const aportesPending =
      aporteOriginalIds.length > 0
        ? await prisma.bill.findMany({
            where: {
              tenantId,
              type: "payable",
              status: "pending",
              billCategoryId: { in: aporteOriginalIds },
            },
            select: { amount: true },
          })
        : []
    const aportesPendingTotal = aportesPending.reduce((s, b) => s + b.amount, 0)

    const amortizacoesTotais = amortizacaoSubId
      ? await prisma.bill.findMany({
          where: {
            tenantId,
            type: "payable",
            status: "paid",
            billCategoryId: amortizacaoSubId,
          },
          select: { amount: true },
        })
      : []
    const amortizadoAcumulado = amortizacoesTotais.reduce((s, b) => s + b.amount, 0)
    const aportesADevolver = Math.max(0, aportesPendingTotal - amortizadoAcumulado)

    // Contas pendentes (fora aportes e pró-labore)
    const contasPagarPending = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        status: "pending",
        NOT: [
          { billCategoryId: { in: aporteOriginalIds.length > 0 ? aporteOriginalIds : ["__none__"] } },
          ...(proLaboreSub ? [{ billCategoryId: proLaboreSub.id }] : []),
        ],
      },
      select: { amount: true },
    })
    const contasPagarTotal = contasPagarPending.reduce((s, b) => s + b.amount, 0)

    const contasReceberPending = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "receivable",
        status: "pending",
      },
      select: { amount: true },
    })
    const contasReceberTotal = contasReceberPending.reduce((s, b) => s + b.amount, 0)

    // MP a liberar (cache)
    const mpIntegration = await prisma.mPIntegration.findUnique({
      where: { tenantId },
      select: { cachedUnavailableBalance: true, cachedSyncedAt: true },
    })
    const mpALiberar = mpIntegration?.cachedUnavailableBalance ?? 0

    // Lucro acumulado YTD
    const receitasAno = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "receivable",
        NOT: { status: "cancelled" },
        paidDate: { gte: startYear, lt: end },
      },
      select: { amount: true, productCost: true },
    })
    const receitaYTDBruta = receitasAno.reduce((s, b) => s + b.amount, 0)
    const cmvYTDCadastrado = receitasAno.reduce((s, b) => s + (b.productCost || 0), 0)

    const aporteMercadoriaYTD = aporteMercadoriaSubId
      ? await prisma.bill.findMany({
          where: {
            tenantId,
            type: "payable",
            billCategoryId: aporteMercadoriaSubId,
            NOT: { status: "cancelled" },
            dueDate: { gte: startYear, lt: end },
          },
          select: { amount: true },
        })
      : []
    const aporteMercadoriaYTDTotal = aporteMercadoriaYTD.reduce((s, b) => s + b.amount, 0)
    const cmvYTD = Math.max(cmvYTDCadastrado, aporteMercadoriaYTDTotal)

    const despesasYTD = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        status: "paid",
        paidDate: { gte: startYear, lt: end },
        category: { not: "reposicao_estoque" },
        NOT: [
          { billCategoryId: { in: aporteOriginalIds.length > 0 ? aporteOriginalIds : ["__none__"] } },
          ...(proLaboreSub ? [{ billCategoryId: proLaboreSub.id }] : []),
        ],
      },
      select: { amount: true },
    })
    const despesasYTDTotal = despesasYTD.reduce((s, b) => s + b.amount, 0)

    const aportesOperacionaisYTD =
      aporteOperacionalIds.length > 0
        ? await prisma.bill.findMany({
            where: {
              tenantId,
              type: "payable",
              billCategoryId: { in: aporteOperacionalIds },
              NOT: { status: "cancelled" },
              dueDate: { gte: startYear, lt: end },
            },
            select: { amount: true },
          })
        : []
    const aportesOperacionaisYTDTotal = aportesOperacionaisYTD.reduce((s, b) => s + b.amount, 0)

    const lucroAcumuladoYTD = receitaYTDBruta - cmvYTD - despesasYTDTotal - aportesOperacionaisYTDTotal

    const proLaboresYTD = proLaboreSub
      ? await prisma.bill.findMany({
          where: {
            tenantId,
            type: "payable",
            billCategoryId: proLaboreSub.id,
            NOT: { status: "cancelled" },
            dueDate: { gte: startYear, lt: end },
          },
          select: { amount: true },
        })
      : []
    const proLaboresYTDTotal = proLaboresYTD.reduce((s, b) => s + b.amount, 0)

    const round = (n: number) => Math.round(n * 100) / 100

    return NextResponse.json({
      month: `${year}-${String(month0 + 1).padStart(2, "0")}`,
      resultado: {
        receitaBruta: round(receitaBruta),
        cmvDoMes: round(cmvDoMes),
        cmvSource:
          cmvCadastrado > 0 && cmvCadastrado >= aporteMercadoriaNoMes
            ? "productCost"
            : aporteMercadoriaNoMes > 0
            ? "aporte"
            : "none",
        receitaLiquida: round(receitaLiquida),
        despesasPagas: round(despesasTotal),
        aportesOperacionais: round(aportesOperacionaisTotal),
        lucroLiquido: round(lucroLiquido),
      },
      movimento: {
        entradas: round(entradasTotal),
        saidasOperacionais: round(saidasOperacionais),
        saidasAmortizacao: round(saidasAmortizacao),
        saidasProLabore: round(saidasProLabore),
        saidasTotal: round(saidasTotal),
        fluxoLiquido: round(entradasTotal - saidasTotal),
      },
      posicao: {
        aportesADevolver: round(aportesADevolver),
        aportesLancados: round(aportesPendingTotal),
        amortizadoAcumulado: round(amortizadoAcumulado),
        contasPagarPendentes: round(contasPagarTotal),
        contasReceberPendentes: round(contasReceberTotal),
        mpALiberar: round(mpALiberar),
        mpSyncedAt: mpIntegration?.cachedSyncedAt ?? null,
        lucroAcumuladoYTD: round(lucroAcumuladoYTD),
        proLaboresYTD: round(proLaboresYTDTotal),
      },
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[balancete]", err)
    return NextResponse.json({ error: "Erro ao calcular balancete" }, { status: 500 })
  }
}
