/**
 * Modelo de "envelopes" / caixas virtuais aplicado ao agLivre.
 *
 * Em vez de tratar compra de mercadoria como despesa (que duplicaria
 * o custo no DRE — uma vez como CMV, outra como despesa operacional),
 * separamos um percentual da receita líquida num "Caixa de Reposição".
 *
 * Caixas:
 *  - Reposição de Estoque: % da receita líquida × pct − bills com
 *    category='reposicao_estoque' pagas no período. Saldo positivo
 *    significa "tenho R$ X reservados pra próxima compra de produto".
 *  - Operacional: lucro líquido real do mês (receita − taxas − CMV
 *    − despesas operacionais SEM a reposição).
 *  - Reserva: o saldoCaixaAtual informado em FinancialSettings.
 *
 * Valores são SIMULADOS — nenhum dinheiro é movido entre contas
 * reais. É só uma forma de visualizar o caixa em compartimentos.
 */

import prisma from "./prisma"
import { TRIAL_DAYS as _ } from "./plans"
void _

export const REPOSICAO_CATEGORY = "reposicao_estoque"

export interface CashPoolsResult {
  /** Período analisado */
  period: { start: Date; end: Date }
  /** % aplicado da receita líquida pra reposição (tirado de FinancialSettings) */
  reposicaoPct: number
  /** Vendas líquidas no período (receita − taxas) */
  vendasLiquidas: number
  /** Quanto foi alocado pro caixa de reposição (vendasLiquidas × reposicaoPct/100) */
  alocadoReposicao: number
  /** Quanto saiu como reposição de estoque (bills pagas com category=reposicao_estoque) */
  gastoReposicao: number
  /** Saldo da Caixa de Reposição = alocadoReposicao − gastoReposicao */
  caixaReposicao: number
  /** Saldo declarado pelo user em FinancialSettings.saldoCaixaAtual */
  caixaReserva: number
}

interface CalcParams {
  tenantId: string
  /** Início do período (inclusive). Default: 1º do mês corrente. */
  start?: Date
  /** Fim do período (exclusive). Default: agora. */
  end?: Date
}

export async function calcularCaixas(params: CalcParams): Promise<CashPoolsResult> {
  const { tenantId } = params
  const now = new Date()
  const start =
    params.start ?? new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const end = params.end ?? now

  const [settings, vendas, reposicoes] = await Promise.all([
    prisma.financialSettings.findUnique({ where: { tenantId } }),
    // Bills de venda pagas no período (recebidas)
    prisma.bill.findMany({
      where: {
        tenantId,
        type: "receivable",
        category: "venda",
        status: { in: ["paid", "pending"] },
        paidDate: { gte: start, lt: end },
      },
      select: { amount: true },
    }),
    // Bills de reposição pagas no período (saídas pra repor estoque)
    prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        category: REPOSICAO_CATEGORY,
        status: "paid",
        paidDate: { gte: start, lt: end },
      },
      select: { amount: true },
    }),
  ])

  const reposicaoPct = settings?.reposicaoPct ?? 50
  const vendasLiquidas = vendas.reduce((s, b) => s + b.amount, 0)
  const gastoReposicao = reposicoes.reduce((s, b) => s + b.amount, 0)
  const alocadoReposicao = vendasLiquidas * (reposicaoPct / 100)
  const caixaReposicao = alocadoReposicao - gastoReposicao
  const caixaReserva = settings?.saldoCaixaAtual ?? 0

  return {
    period: { start, end },
    reposicaoPct,
    vendasLiquidas,
    alocadoReposicao,
    gastoReposicao,
    caixaReposicao,
    caixaReserva,
  }
}
