import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/relatorios/pro-labore?month=YYYY-MM
 *
 * BASE DE CAIXA REAL — não competência. O pró-labore depende de
 * dinheiro DISPONÍVEL, não lucro contábil. Vendas em pending no MP
 * não entram (o dinheiro ainda vai cair).
 *
 * Fonte da receita do mês:
 *  - PRIMÁRIA: MPIntegration.cachedReleasedDays (o que o MP REALMENTE
 *    liberou no mês — alimentado pelo botão "Atualizar" do card MP).
 *  - FALLBACK: bills receivable status=paid no mês (heurística do cron
 *    release-and-refunds que flipa pending→paid após dueDate).
 *
 * Despesas: bills payable status=paid (igual antes — já era caixa real).
 *
 * Cálculo:
 *  - caixaNovoMes = receitaDisponivelMes − despesasPagasMes
 *  - baseDisponivel = max(0, caixaAcumuladoYTD − proLaboresYTD)
 *  - proLaboreSeguro = baseDisponivel − amortização − reinvest − reservaFaltando
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

    // ---- RECEITA DISPONÍVEL DO MÊS — base de caixa real ----
    // PRIMÁRIA: MP.cachedReleasedDays filtrado pelo mês selecionado.
    // FALLBACK: bills receivable status=paid no mês.
    interface MPReleasedPayment {
      id: number
      externalReference: string | null
      netAmount: number
    }
    interface MPReleasedDay {
      date: string
      total: number
      count: number
      payments?: MPReleasedPayment[]
    }
    const mpIntegration = await prisma.mPIntegration.findUnique({
      where: { tenantId },
      select: { cachedReleasedDays: true, cachedSyncedAt: true },
    })
    const releasedDays = (mpIntegration?.cachedReleasedDays as unknown as MPReleasedDay[] | null) ?? []
    const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const monthYM = ymOf(start)
    const releasedDoMes = releasedDays.filter((d) => d.date.slice(0, 7) === monthYM)
    const mpReleasedNoMes = releasedDoMes.reduce((s, d) => s + d.total, 0)
    const mpReady = mpIntegration != null && releasedDays.length > 0

    // ---- CMV CORRESPONDENTE — matching exato dos pagamentos liberados ----
    // Cada payment do MP tem externalReference que costuma ser o ID do
    // pedido ML. A nossa Bill guarda mlOrderId="order_${id}". Casamos os
    // dois e somamos o productCost das bills correspondentes — assim o
    // CMV reflete exatamente o que originou os R$ liberados (não importa
    // a data do pedido — pode ser do mês passado, é o caso normal).
    const paymentsLiberadosNoMes = releasedDoMes.flatMap((d) => d.payments ?? [])
    const externalRefs = paymentsLiberadosNoMes
      .map((p) => p.externalReference)
      .filter((r): r is string => !!r)
    // ML order_id pode aparecer nu ou prefixado — tenta as duas formas
    const orderIdCandidates = Array.from(
      new Set(externalRefs.flatMap((r) => [r, `order_${r}`])),
    )
    const billsCorrespondentes = orderIdCandidates.length > 0
      ? await prisma.bill.findMany({
          where: { tenantId, mlOrderId: { in: orderIdCandidates } },
          select: { mlOrderId: true, amount: true, productCost: true },
        })
      : []
    const cmvCorrespondente = billsCorrespondentes.reduce(
      (s, b) => s + (b.productCost ?? 0),
      0,
    )
    const billsCorrespondentesSemCusto = billsCorrespondentes.filter(
      (b) => b.productCost == null,
    ).length
    const paymentsSemMatch = Math.max(
      0,
      paymentsLiberadosNoMes.length - billsCorrespondentes.length,
    )

    // Pra fallback (sem MP): bills paid no mês com seu CMV ratio
    const receitasPagasMes = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "receivable",
        status: "paid",
        paidDate: { gte: start, lt: end },
      },
      select: { amount: true, productCost: true },
    })
    const billsPaidNoMes = receitasPagasMes.reduce((s, b) => s + b.amount, 0)
    const cmvCadastrado = receitasPagasMes.reduce((s, b) => s + (b.productCost || 0), 0)

    // Fonte autoritária da receita disponível: MP se tiver dados, senão bills paid
    const receitaBruta = mpReady ? mpReleasedNoMes : billsPaidNoMes
    const receitaSource: "mp" | "bills_paid" = mpReady ? "mp" : "bills_paid"

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

    // Reposição de estoque paga no mês — usada como proxy de CMV quando
    // o usuário ainda não cadastrou custos dos anúncios (cmvCadastrado=0).
    const reposicaoPagaBills = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        status: "paid",
        category: "reposicao_estoque",
        paidDate: { gte: start, lt: end },
      },
      select: { amount: true },
    })
    const reposicaoPagaNoMes = reposicaoPagaBills.reduce((s, b) => s + b.amount, 0)

    // CMV do mês — preferência:
    //  1) cmvCorrespondente (matching MP↔bill, exato): usa direto.
    //  2) Sem MP ou sem matches: cmvCadastrado proporcional (fallback).
    //  3) Sem nada: 0.
    const cmvRatio = billsPaidNoMes > 0 ? cmvCadastrado / billsPaidNoMes : 0
    const cmvProporcional = mpReady ? receitaBruta * cmvRatio : cmvCadastrado
    const cmvDoMes = mpReady && cmvCorrespondente > 0
      ? cmvCorrespondente
      : cmvProporcional
    const cmvSource: "matching_exact" | "productCost_proportional" | "none" =
      mpReady && cmvCorrespondente > 0
        ? "matching_exact"
        : cmvCadastrado > 0
          ? "productCost_proportional"
          : "none"
    const cmvFaltando = cmvCadastrado === 0 && aporteMercadoriaNoMes > 0

    // RESERVA PARA ESTOQUE — peça-chave do modelo:
    // O CMV das vendas que liberaram dinheiro este mês JÁ É um
    // compromisso, mesmo que você ainda não tenha pago a reposição
    // (gap de 30d entre venda e liberação MP).
    // Desconta o MAIOR entre cmvDoMes e reposicaoPagaNoMes:
    //   - Se reposição < CMV: você ainda precisa repor (CMV − pago)
    //   - Se reposição ≥ CMV: você já adiantou estoque pra meses futuros
    const descontoPraEstoque = Math.max(cmvDoMes, reposicaoPagaNoMes)
    const pendenteReposicao = Math.max(0, cmvDoMes - reposicaoPagaNoMes)
    const adiantadoReposicao = Math.max(0, reposicaoPagaNoMes - cmvDoMes)

    // "Lucro real recebido" = receita − reserva pra estoque.
    const receitaRecebida = receitaBruta - descontoPraEstoque

    // Despesas operacionais pagas no mês (status=paid, exclui aporte
    // e reposição de estoque — esta já entrou como CMV proxy quando
    // não há productCost; senão vai pro Caixa de Reposição.
    // Ver lib/cash-pools.ts).
    const despesasPagas = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        status: "paid",
        paidDate: { gte: start, lt: end },
        category: { not: "reposicao_estoque" },
        NOT: [
          { billCategoryId: { in: aporteIds.length > 0 ? aporteIds : ["__none__"] } },
        ],
      },
      select: { amount: true },
    })
    const despesasPagasTotal = despesasPagas.reduce((s, b) => s + b.amount, 0)

    // Aportes operacionais do mês (só pra display — NÃO entra no lucro).
    // Aporte é passivo (dívida com sócio), não despesa da loja.
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
    const aportesNoMesTotal = aporteMercadoriaNoMes + aportesOperacionaisNoMes

    // Custo operacional = apenas despesas pagas. Aportes ficam como passivo.
    const custoOperacionalTotal = despesasPagasTotal
    const lucroLiquido = receitaRecebida - custoOperacionalTotal

    // ---- CAIXA ACUMULADO YTD (mês a mês) ----
    // Receita liberada (paid) − despesas pagas, jan até o mês selecionado.
    // Assim o pró-labore desconta meses ruins anteriores.
    const inicioAno = new Date(year, 0, 1, 0, 0, 0, 0)
    const [receitasAno, despesasAno, aportesAnoAll, proLaboresAnoAll] = await Promise.all([
      prisma.bill.findMany({
        where: {
          tenantId,
          type: "receivable",
          status: "paid",
          paidDate: { gte: inicioAno, lt: end },
        },
        select: { amount: true, productCost: true },
      }),
      prisma.bill.findMany({
        where: {
          tenantId,
          type: "payable",
          status: "paid",
          paidDate: { gte: inicioAno, lt: end },
          category: { not: "reposicao_estoque" },
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
    const cmvYTD = receitasAno.reduce((s, b) => s + (b.productCost || 0), 0)
    const despesaYTD = despesasAno.reduce((s, b) => s + b.amount, 0)
    const _aportesYTD = aportesAnoAll.reduce((s, b) => s + b.amount, 0) // só info
    void _aportesYTD
    const proLaboresYTD = proLaboresAnoAll.reduce((s, b) => s + b.amount, 0)
    // Lucro acumulado = receita − CMV − despesas (aportes ficam como passivo)
    const lucroAcumuladoYTD = receitaYTD - cmvYTD - despesaYTD
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

    // CAIXA DO MÊS — o que sobrou após cobrir estoque e despesas:
    //   liberado MP − max(CMV, reposição paga) − despesas pagas
    const caixaDoMes = receitaBruta - descontoPraEstoque - despesasPagasTotal

    // PRÓ-LABORE FINAL — caixa do mês menos compromissos sugeridos:
    //   − amortização do aporte (empréstimo do sócio)
    //   − reinvestimento (% pra crescer)
    //   − reserva pendente (colchão)
    const sobra = caixaDoMes - aporteAmortizacaoSugerida - reinvestSugerido - faltaParaReserva
    const proLaboreSeguro = Math.max(0, Math.round(sobra * 100) / 100)
    const proLaboreDireto = Math.max(0, Math.round(caixaDoMes * 100) / 100)

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
      // Caixa real do mês — base do pró-labore
      receitaBruta: Math.round(receitaBruta * 100) / 100,
      receitaSource,
      mpReleasedNoMes: Math.round(mpReleasedNoMes * 100) / 100,
      billsPaidNoMes: Math.round(billsPaidNoMes * 100) / 100,
      mpSyncedAt: mpIntegration?.cachedSyncedAt ? mpIntegration.cachedSyncedAt.toISOString() : null,
      cmvDoMes: Math.round(cmvDoMes * 100) / 100,
      cmvCorrespondente: Math.round(cmvCorrespondente * 100) / 100,
      cmvSource,
      paymentsLiberadosCount: paymentsLiberadosNoMes.length,
      paymentsSemMatch,
      billsCorrespondentesSemCusto,
      reposicaoPagaNoMes: Math.round(reposicaoPagaNoMes * 100) / 100,
      descontoPraEstoque: Math.round(descontoPraEstoque * 100) / 100,
      pendenteReposicao: Math.round(pendenteReposicao * 100) / 100,
      adiantadoReposicao: Math.round(adiantadoReposicao * 100) / 100,
      caixaDoMes: Math.round(caixaDoMes * 100) / 100,
      receitaRecebida: Math.round(receitaRecebida * 100) / 100,
      despesasPagas: Math.round(despesasPagasTotal * 100) / 100,
      aportesNoMes: Math.round(aportesNoMesTotal * 100) / 100,
      aporteMercadoriaNoMes: Math.round(aporteMercadoriaNoMes * 100) / 100,
      aportesOperacionaisNoMes: Math.round(aportesOperacionaisNoMes * 100) / 100,
      cmvFaltando,
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
      proLaboreDireto,
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
