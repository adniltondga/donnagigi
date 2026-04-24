import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/relatorios/balanco?month=YYYY-MM
 *
 * Balanço Patrimonial simplificado — foto do patrimônio na data de corte
 * (fim do mês informado ou hoje). Estrutura:
 *
 *   ATIVO                    |  PASSIVO + PATRIMÔNIO LÍQUIDO
 *   Caixa (saldo informado)  |  Contas a pagar (pending)
 *   MP a liberar             |  Aportes a devolver (pending − amortizado)
 *   Contas a receber (pend.) |  ───────────────────────
 *                            |  Patrimônio líquido
 *                            |    Lucros acumulados YTD
 *                            |    (−) Pró-labores pagos
 *
 * Pra bater no modelo contábil: Ativo = Passivo + PL. A diferença
 * (se houver) é o "resultado de caixa não registrado" e indica que falta
 * cadastrar saldo em caixa nas Configurações.
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
    const startYear = new Date(year, 0, 1, 0, 0, 0, 0)
    const end = new Date(year, month0 + 1, 1, 0, 0, 0, 0)

    // IDs de categorias
    const aporteRoot = await prisma.billCategory.findFirst({
      where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
      select: { id: true, children: { select: { id: true, name: true } } },
    })
    const amortizacaoSubId = aporteRoot?.children.find((c) => c.name === "Amortização")?.id ?? null
    const aporteOriginalIds = aporteRoot
      ? [aporteRoot.id, ...aporteRoot.children.filter((c) => c.name !== "Amortização").map((c) => c.id)]
      : []
    const proLaboreSub = await prisma.billCategory.findFirst({
      where: { tenantId, type: "payable", name: "Pró-labore", parent: { name: "Pessoal" } },
      select: { id: true },
    })

    /* ====== ATIVO ====== */
    const settings = await prisma.financialSettings.findUnique({
      where: { tenantId },
      select: { saldoCaixaAtual: true, saldoAtualizadoEm: true },
    })
    const caixa = settings?.saldoCaixaAtual ?? 0

    const mpIntegration = await prisma.mPIntegration.findUnique({
      where: { tenantId },
      select: { cachedUnavailableBalance: true, cachedSyncedAt: true },
    })
    const mpALiberar = mpIntegration?.cachedUnavailableBalance ?? 0

    const receberPending = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "receivable",
        status: "pending",
      },
      select: { amount: true },
    })
    const contasReceber = receberPending.reduce((s, b) => s + b.amount, 0)

    const ativoTotal = caixa + mpALiberar + contasReceber

    /* ====== PASSIVO ====== */
    const pagarPending = await prisma.bill.findMany({
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
    const contasPagar = pagarPending.reduce((s, b) => s + b.amount, 0)

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
    const aportesLancados = aportesPending.reduce((s, b) => s + b.amount, 0)

    const amortizado = amortizacaoSubId
      ? await prisma.bill.findMany({
          where: {
            tenantId,
            type: "payable",
            status: "paid",
            billCategoryId: amortizacaoSubId,
            paidDate: { lt: end },
          },
          select: { amount: true },
        })
      : []
    const amortizadoTotal = amortizado.reduce((s, b) => s + b.amount, 0)
    const aportesADevolver = Math.max(0, aportesLancados - amortizadoTotal)

    const pagarPending_proLabore = proLaboreSub
      ? await prisma.bill.findMany({
          where: {
            tenantId,
            type: "payable",
            status: "pending",
            billCategoryId: proLaboreSub.id,
          },
          select: { amount: true },
        })
      : []
    const proLaboresPending = pagarPending_proLabore.reduce((s, b) => s + b.amount, 0)

    const passivoTotal = contasPagar + aportesADevolver + proLaboresPending

    /* ====== PATRIMÔNIO LÍQUIDO ====== */
    const receitasAno = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "receivable",
        NOT: { status: "cancelled" },
        paidDate: { gte: startYear, lt: end },
      },
      select: { amount: true, productCost: true },
    })
    const receitaYTD = receitasAno.reduce((s, b) => s + b.amount, 0)
    const cmvYTD = receitasAno.reduce((s, b) => s + (b.productCost || 0), 0)

    const despesasAno = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        status: "paid",
        paidDate: { gte: startYear, lt: end },
        NOT: [
          { billCategoryId: { in: aporteOriginalIds.length > 0 ? aporteOriginalIds : ["__none__"] } },
          ...(proLaboreSub ? [{ billCategoryId: proLaboreSub.id }] : []),
        ],
      },
      select: { amount: true },
    })
    const despesasYTD = despesasAno.reduce((s, b) => s + b.amount, 0)
    const lucroAcumuladoYTD = receitaYTD - cmvYTD - despesasYTD

    const proLaboresPaidAno = proLaboreSub
      ? await prisma.bill.findMany({
          where: {
            tenantId,
            type: "payable",
            status: "paid",
            billCategoryId: proLaboreSub.id,
            paidDate: { gte: startYear, lt: end },
          },
          select: { amount: true },
        })
      : []
    const proLaboresPagosYTD = proLaboresPaidAno.reduce((s, b) => s + b.amount, 0)

    // PL = lucros acumulados − pró-labores pagos
    const patrimonioLiquido = lucroAcumuladoYTD - proLaboresPagosYTD

    const passivoMaisPL = passivoTotal + patrimonioLiquido
    const descasamento = ativoTotal - passivoMaisPL

    const round = (n: number) => Math.round(n * 100) / 100

    return NextResponse.json({
      month: `${year}-${String(month0 + 1).padStart(2, "0")}`,
      ativo: {
        caixa: round(caixa),
        caixaInformado: settings?.saldoCaixaAtual != null,
        caixaAtualizadoEm: settings?.saldoAtualizadoEm ?? null,
        mpALiberar: round(mpALiberar),
        mpSyncedAt: mpIntegration?.cachedSyncedAt ?? null,
        contasReceber: round(contasReceber),
        total: round(ativoTotal),
      },
      passivo: {
        contasPagar: round(contasPagar),
        aportesADevolver: round(aportesADevolver),
        aportesLancados: round(aportesLancados),
        amortizadoAcumulado: round(amortizadoTotal),
        proLaboresPendentes: round(proLaboresPending),
        total: round(passivoTotal),
      },
      patrimonioLiquido: {
        lucroAcumuladoYTD: round(lucroAcumuladoYTD),
        proLaboresPagosYTD: round(proLaboresPagosYTD),
        total: round(patrimonioLiquido),
      },
      passivoMaisPL: round(passivoMaisPL),
      descasamento: round(descasamento),
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[balanco]", err)
    return NextResponse.json({ error: "Erro ao calcular balanço" }, { status: 500 })
  }
}
