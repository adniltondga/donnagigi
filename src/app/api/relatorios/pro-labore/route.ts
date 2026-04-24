import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/relatorios/pro-labore?month=YYYY-MM
 *
 * Calcula o pró-labore seguro seguindo "Pay Yourself Last": só o que
 * sobra depois de cobrir operação, aportes, reserva e reinvestimento.
 *
 * - receitaRecebida30d: bills receivable pagas no período
 * - despesasPagas30d: bills payable pagas no período (exclui aporte sócio,
 *   que é "dívida interna", não despesa operacional real)
 * - lucroLiquido: receita - despesas
 * - contasAPagarDoMes: bills payable pending com dueDate no mês
 * - aportesADevolver: bills payable pending da categoria raiz "Aporte sócio"
 * - reservaMeta: reservaMeses × média de despesas fixas dos últimos 3 meses
 * - reservaAtual: saldoCaixaAtual do settings (user-informed)
 * - reinvestSugerido: lucroLiquido × reinvestPct
 * - proLaboreSeguro: lucroLiquido − contasAPagarDoMes − amortizaçãoAporte
 *   − reinvestSugerido − (reservaMeta − reservaAtual) (se faltar reserva)
 * - historicoPorMes: últimos 6 meses de pró-labore realmente lançados
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

    // Settings (ou defaults)
    const settings =
      (await prisma.financialSettings.findUnique({ where: { tenantId } })) ||
      ({ reservaMeses: 3, reinvestPct: 20, saldoCaixaAtual: null, saldoAtualizadoEm: null } as const)

    // IDs das categorias "Aporte sócio" (raiz + filhas) e "Pró-labore"
    const aporteRoot = await prisma.billCategory.findFirst({
      where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
      select: { id: true, children: { select: { id: true } } },
    })
    const aporteIds = aporteRoot
      ? [aporteRoot.id, ...aporteRoot.children.map((c) => c.id)]
      : []

    const proLaboreSub = await prisma.billCategory.findFirst({
      where: { tenantId, type: "payable", name: "Pró-labore", parent: { name: "Pessoal" } },
      select: { id: true },
    })

    // Receita recebida no mês (receivable, paga)
    const receitas = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "receivable",
        NOT: { status: "cancelled" },
        paidDate: { gte: start, lt: end },
      },
      select: { amount: true },
    })
    const receitaRecebida = receitas.reduce((s, b) => s + b.amount, 0)

    // Despesas operacionais pagas no mês (payable status=paid, exclui aporte — não é "despesa real")
    const despesasPagas = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        status: "paid",
        paidDate: { gte: start, lt: end },
        NOT: [
          { billCategoryId: { in: aporteIds.length > 0 ? aporteIds : ["__none__"] } },
        ],
      },
      select: { amount: true },
    })
    const despesasPagasTotal = despesasPagas.reduce((s, b) => s + b.amount, 0)

    const lucroLiquido = receitaRecebida - despesasPagasTotal

    // Contas a pagar pendentes com dueDate no mês (exclui aporte)
    const contasDoMes = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        status: "pending",
        dueDate: { gte: start, lt: end },
        NOT: [
          { billCategoryId: { in: aporteIds.length > 0 ? aporteIds : ["__none__"] } },
        ],
      },
      select: { amount: true, dueDate: true },
    })
    const contasAPagarMesTotal = contasDoMes.reduce((s, b) => s + b.amount, 0)
    const now = new Date()
    const in7 = new Date(now)
    in7.setDate(in7.getDate() + 7)
    const contasVencendo7d = contasDoMes.filter(
      (b) => b.dueDate >= now && b.dueDate <= in7
    ).length

    // Aportes a devolver: todas as bills payable da categoria "Aporte sócio"
    // que ainda estão pendentes (independente de dueDate, independente de mês).
    const aportes =
      aporteIds.length > 0
        ? await prisma.bill.findMany({
            where: {
              tenantId,
              type: "payable",
              status: "pending",
              billCategoryId: { in: aporteIds },
            },
            select: { amount: true },
          })
        : []
    const aportesADevolver = aportes.reduce((s, b) => s + b.amount, 0)

    // ---- FLUXO DE CAIXA PROJETADO (30 dias à frente) ----
    // Base real do cálculo de pró-labore. Lucro líquido contábil é só
    // info auxiliar — o que importa é ter dinheiro.
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const em30d = new Date(hoje)
    em30d.setDate(em30d.getDate() + 30)

    // Saldo inicial = saldo em caixa informado pelo user
    const saldoCaixaHoje = settings.saldoCaixaAtual ?? 0

    // Entradas MP confirmadas (liberações programadas até 30d)
    const mpIntegration = await prisma.mPIntegration.findUnique({
      where: { tenantId },
      select: { cachedPendingDays: true },
    })
    let entradasMP30d = 0
    if (mpIntegration?.cachedPendingDays) {
      const days = mpIntegration.cachedPendingDays as Array<{ date: string; total: number }>
      for (const d of days) {
        const [y, m, dd] = d.date.split("-").map(Number)
        const dt = new Date(y, m - 1, dd)
        if (dt >= hoje && dt <= em30d) entradasMP30d += d.total
      }
    }

    // Entradas manuais (bills receivable pending com dueDate até 30d; exclui
    // vendas ML que já vêm pelo MP).
    const entradasManuaisBills = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "receivable",
        status: "pending",
        NOT: [{ category: "venda" }],
        dueDate: { gte: hoje, lte: em30d },
      },
      select: { amount: true },
    })
    const entradasManuais30d = entradasManuaisBills.reduce((s, b) => s + b.amount, 0)

    // Saídas (contas a pagar com dueDate até 30d; exclui aportes — tratados separados)
    const saidasBills = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        status: "pending",
        NOT: [
          { billCategoryId: { in: aporteIds.length > 0 ? aporteIds : ["__none__"] } },
        ],
        dueDate: { gte: hoje, lte: em30d },
      },
      select: { amount: true },
    })
    const saidas30d = saidasBills.reduce((s, b) => s + b.amount, 0)

    const entradas30d = entradasMP30d + entradasManuais30d
    const saldoProjetado30d =
      Math.round((saldoCaixaHoje + entradas30d - saidas30d) * 100) / 100

    // Despesa fixa média dos últimos 3 meses (pra cálculo da reserva)
    const tresMesesAtras = new Date(year, month0 - 3, 1)
    const despesas3m = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        status: "paid",
        paidDate: { gte: tresMesesAtras, lt: start },
        NOT: [
          { billCategoryId: { in: aporteIds.length > 0 ? aporteIds : ["__none__"] } },
          { category: "venda" },
        ],
      },
      select: { amount: true },
    })
    const despesaFixaMedia =
      despesas3m.length > 0 ? despesas3m.reduce((s, b) => s + b.amount, 0) / 3 : 0

    const reservaMeta = Math.round(despesaFixaMedia * settings.reservaMeses * 100) / 100
    const reservaAtual = settings.saldoCaixaAtual ?? 0
    const faltaParaReserva = Math.max(0, reservaMeta - reservaAtual)

    const reinvestSugerido =
      lucroLiquido > 0 ? Math.round(((lucroLiquido * settings.reinvestPct) / 100) * 100) / 100 : 0

    // Amortização sugerida de aporte: 1/24 do saldo (meta: quitar em 2 anos)
    // — referência, user pode pagar quanto quiser.
    const aporteAmortizacaoSugerida = Math.round((aportesADevolver / 24) * 100) / 100

    // Pró-labore seguro = SALDO PROJETADO em 30d menos as alocações restantes.
    // As contas a pagar dos próximos 30d já foram descontadas no saldoProjetado30d.
    const sobra =
      saldoProjetado30d -
      aporteAmortizacaoSugerida -
      reinvestSugerido -
      faltaParaReserva
    const proLaboreSeguro = Math.max(0, Math.round(sobra * 100) / 100)

    // Histórico últimos 6 meses de pró-labore lançado
    let historico: Array<{ month: string; total: number }> = []
    if (proLaboreSub) {
      const seisMesesAtras = new Date(year, month0 - 5, 1)
      const lancamentos = await prisma.bill.findMany({
        where: {
          tenantId,
          type: "payable",
          billCategoryId: proLaboreSub.id,
          dueDate: { gte: seisMesesAtras, lt: end },
        },
        select: { amount: true, dueDate: true },
      })
      const byMonth = new Map<string, number>()
      for (const l of lancamentos) {
        const ym = `${l.dueDate.getFullYear()}-${String(l.dueDate.getMonth() + 1).padStart(2, "0")}`
        byMonth.set(ym, (byMonth.get(ym) || 0) + l.amount)
      }
      historico = Array.from(byMonth.entries())
        .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }))
        .sort((a, b) => a.month.localeCompare(b.month))
    }

    return NextResponse.json({
      month: `${year}-${String(month0 + 1).padStart(2, "0")}`,
      // Resumo contábil do mês (info auxiliar — não entra no cálculo de pró-labore)
      receitaRecebida: Math.round(receitaRecebida * 100) / 100,
      despesasPagas: Math.round(despesasPagasTotal * 100) / 100,
      lucroLiquido: Math.round(lucroLiquido * 100) / 100,
      // Fluxo de caixa 30 dias (base do cálculo real)
      fluxoCaixa: {
        saldoHoje: Math.round(saldoCaixaHoje * 100) / 100,
        entradasMP30d: Math.round(entradasMP30d * 100) / 100,
        entradasManuais30d: Math.round(entradasManuais30d * 100) / 100,
        entradasTotal30d: Math.round(entradas30d * 100) / 100,
        saidas30d: Math.round(saidas30d * 100) / 100,
        saldoProjetado30d,
      },
      contasAPagarDoMes: {
        total: Math.round(contasAPagarMesTotal * 100) / 100,
        count: contasDoMes.length,
        vencendo7d: contasVencendo7d,
      },
      aportesADevolver: {
        total: Math.round(aportesADevolver * 100) / 100,
        count: aportes.length,
        amortizacaoSugerida: aporteAmortizacaoSugerida,
      },
      reserva: {
        meta: reservaMeta,
        atual: reservaAtual,
        despesaFixaMedia: Math.round(despesaFixaMedia * 100) / 100,
        meses: settings.reservaMeses,
        pctAtingido: reservaMeta > 0 ? Math.min(100, (reservaAtual / reservaMeta) * 100) : 100,
        falta: faltaParaReserva,
      },
      reinvestimento: {
        pct: settings.reinvestPct,
        sugerido: reinvestSugerido,
      },
      proLaboreSeguro,
      proLaboreSubcategoryId: proLaboreSub?.id ?? null,
      historicoPorMes: historico,
      saldoCaixa: {
        informado: settings.saldoCaixaAtual != null,
        valor: settings.saldoCaixaAtual,
        atualizadoEm: settings.saldoAtualizadoEm,
      },
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[pro-labore GET]", err)
    return NextResponse.json({ error: "Erro ao calcular pró-labore" }, { status: 500 })
  }
}
