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

    // IDs das categorias "Aporte sócio" (raiz + filhas), "Pró-labore" e
    // sub "Amortização" (que é um filho especial de Aporte sócio).
    const aporteRoot = await prisma.billCategory.findFirst({
      where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
      select: { id: true, children: { select: { id: true, name: true } } },
    })
    const amortizacaoSubId = aporteRoot?.children.find((c) => c.name === "Amortização")?.id ?? null
    // Sub "Mercadoria" especificamente — é custo de mercadoria (vira CMV).
    const aporteMercadoriaSubId = aporteRoot?.children.find((c) => c.name === "Mercadoria")?.id ?? null
    const aporteIds = aporteRoot
      ? [aporteRoot.id, ...aporteRoot.children.map((c) => c.id)]
      : []
    // Pra contar como "aporte original" (custo do sócio), excluir Amortização
    const aporteOriginalIds = aporteRoot
      ? [aporteRoot.id, ...aporteRoot.children.filter((c) => c.name !== "Amortização").map((c) => c.id)]
      : []
    // Aportes "operacionais" (não-mercadoria): embalagem, frete, outros. A
    // Mercadoria é tratada como CMV pra não duplicar com productCost.
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

    // Receita recebida no mês (receivable, paga) com productCost pra CMV
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

    // Aportes de mercadoria do mês — proxy do CMV quando user não cadastra
    // productCost mas registra a compra como aporte.
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

    // Custo da mercadoria (CMV efetivo): usa o MAIOR entre productCost
    // cadastrado e aporte mercadoria do mês. Evita double count quando
    // user registra dos dois jeitos. Pra quem usa só aporte (caso atual),
    // vai usar o aporte; pra quem cadastra em Custos ML, usa o CMV preciso.
    const cmvDoMes = Math.max(cmvCadastrado, aporteMercadoriaNoMes)
    const cmvSource: "productCost" | "aporte" | "none" =
      cmvCadastrado > 0 && cmvCadastrado >= aporteMercadoriaNoMes
        ? "productCost"
        : aporteMercadoriaNoMes > 0
        ? "aporte"
        : "none"

    // "Lucro real recebido" = receita − CMV. Já considera o custo da
    // mercadoria (seja via productCost, seja via aporte).
    const receitaRecebida = receitaBruta - cmvDoMes

    // Despesas operacionais pagas no mês (status=paid, exclui aporte)
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

    // Aportes OPERACIONAIS do mês: embalagem, frete, outros — custos que
    // não foram contabilizados no CMV. Excluídos: Amortização (não é custo)
    // e Mercadoria (já entrou como CMV).
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
    const aportesOperacionaisNoMes = aportesOperacionaisBills.reduce((s, b) => s + b.amount, 0)

    // Total de aportes do mês (mercadoria + operacionais) — só pra display
    const aportesNoMesTotal = aporteMercadoriaNoMes + aportesOperacionaisNoMes

    const custoOperacionalTotal = despesasPagasTotal + aportesOperacionaisNoMes
    const lucroLiquido = receitaRecebida - custoOperacionalTotal

    // ---- RESULTADO ACUMULADO YTD (mês a mês) ----
    // Lucros dos meses de janeiro até o mês selecionado (inclusive).
    // Assim o pró-labore desconta prejuízos acumulados dos meses anteriores.
    const inicioAno = new Date(year, 0, 1, 0, 0, 0, 0)
    const [receitasAno, despesasAno, aportesAnoAll, proLaboresAnoAll] = await Promise.all([
      prisma.bill.findMany({
        where: {
          tenantId,
          type: "receivable",
          NOT: { status: "cancelled" },
          paidDate: { gte: inicioAno, lt: end },
        },
        select: { amount: true },
      }),
      prisma.bill.findMany({
        where: {
          tenantId,
          type: "payable",
          status: "paid",
          paidDate: { gte: inicioAno, lt: end },
          NOT: [
            { billCategoryId: { in: aporteIds.length > 0 ? aporteIds : ["__none__"] } },
            ...(proLaboreSub ? [{ billCategoryId: proLaboreSub.id }] : []),
          ],
        },
        select: { amount: true },
      }),
      aporteIds.length > 0
        ? prisma.bill.findMany({
            where: {
              tenantId,
              type: "payable",
              billCategoryId: { in: aporteIds },
              NOT: { status: "cancelled" },
              dueDate: { gte: inicioAno, lt: end },
            },
            select: { amount: true },
          })
        : Promise.resolve([]),
      proLaboreSub
        ? prisma.bill.findMany({
            where: {
              tenantId,
              type: "payable",
              billCategoryId: proLaboreSub.id,
              NOT: { status: "cancelled" },
              dueDate: { gte: inicioAno, lt: end },
            },
            select: { amount: true },
          })
        : Promise.resolve([]),
    ])
    const receitaYTD = receitasAno.reduce((s, b) => s + b.amount, 0)
    const despesaYTD = despesasAno.reduce((s, b) => s + b.amount, 0)
    const aportesYTD = aportesAnoAll.reduce((s, b) => s + b.amount, 0)
    const proLaboresYTD = proLaboresAnoAll.reduce((s, b) => s + b.amount, 0)
    const lucroAcumuladoYTD = receitaYTD - despesaYTD - aportesYTD
    // Base disponível pra tirar = lucro acumulado menos o que já foi tirado
    // como pró-labore no ano (se ainda não marcou como paga, conta também —
    // é um compromisso já tomado).
    const baseDisponivel = Math.max(0, lucroAcumuladoYTD - proLaboresYTD)

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

    // Aportes a devolver = (aportes originais pendentes) − (amortizações pagas)
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

    const amortizacoesPagas = amortizacaoSubId
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
    const amortizadoTotal = amortizacoesPagas.reduce((s, b) => s + b.amount, 0)

    const aportesADevolver = Math.max(0, aportesPendingTotal - amortizadoTotal)
    const aportes = aportesPending // mantém compat pra contagem (linhas)


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
    // Se não há histórico de despesa (meta=0), nem "atingido" nem "falta" — é só
    // não calculável. faltaParaReserva=0 nesse caso mas o front indica o estado.
    const reservaSemHistorico = despesaFixaMedia === 0
    const faltaParaReserva = reservaSemHistorico ? 0 : Math.max(0, reservaMeta - reservaAtual)

    const reinvestSugerido =
      lucroLiquido > 0 ? Math.round(((lucroLiquido * settings.reinvestPct) / 100) * 100) / 100 : 0

    // Amortização sugerida de aporte: 1/24 do saldo (meta: quitar em 2 anos)
    // — referência, user pode pagar quanto quiser.
    const aporteAmortizacaoSugerida = Math.round((aportesADevolver / 24) * 100) / 100

    // Pró-labore seguro = base disponível (lucro acumulado YTD − pró-labores
    // já tirados no ano) − ajustes. Assim, se março deu prejuízo, o lucro de
    // abril é "absorvido" pra cobrir o déficit antes de virar pró-labore.
    const sobra =
      baseDisponivel -
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
      // Fechamento do mês selecionado — base de competência do pró-labore
      receitaBruta: Math.round(receitaBruta * 100) / 100,
      cmvDoMes: Math.round(cmvDoMes * 100) / 100,
      receitaRecebida: Math.round(receitaRecebida * 100) / 100,
      despesasPagas: Math.round(despesasPagasTotal * 100) / 100,
      aportesNoMes: Math.round(aportesNoMesTotal * 100) / 100,
      aporteMercadoriaNoMes: Math.round(aporteMercadoriaNoMes * 100) / 100,
      aportesOperacionaisNoMes: Math.round(aportesOperacionaisNoMes * 100) / 100,
      cmvSource,
      custoOperacionalTotal: Math.round(custoOperacionalTotal * 100) / 100,
      lucroLiquido: Math.round(lucroLiquido * 100) / 100,
      lucroAcumuladoYTD: Math.round(lucroAcumuladoYTD * 100) / 100,
      proLaboresYTD: Math.round(proLaboresYTD * 100) / 100,
      baseDisponivel: Math.round(baseDisponivel * 100) / 100,
      contasAPagarDoMes: {
        total: Math.round(contasAPagarMesTotal * 100) / 100,
        count: contasDoMes.length,
        vencendo7d: contasVencendo7d,
      },
      aportesADevolver: {
        total: Math.round(aportesADevolver * 100) / 100,
        count: aportes.length,
        amortizacaoSugerida: aporteAmortizacaoSugerida,
        totalOriginal: Math.round(aportesPendingTotal * 100) / 100,
        totalAmortizado: Math.round(amortizadoTotal * 100) / 100,
      },
      reserva: {
        meta: reservaMeta,
        atual: reservaAtual,
        despesaFixaMedia: Math.round(despesaFixaMedia * 100) / 100,
        meses: settings.reservaMeses,
        // Se semHistorico=true, não dá pra calcular %. Front mostra estado
        // "Pendente: sem histórico de despesas" em vez de "Atingido".
        semHistorico: reservaSemHistorico,
        pctAtingido: reservaSemHistorico
          ? 0
          : reservaMeta > 0
          ? Math.min(100, (reservaAtual / reservaMeta) * 100)
          : 100,
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
