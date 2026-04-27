/**
 * Helpers de devolução (BillRefund).
 *
 * O modelo: Bill original NUNCA é mexida. Refunds parciais são
 * subtraídos dos totais via funções desse arquivo. Refunds totais
 * (cancelled) já saem das queries pelo filtro `NOT: { status: "cancelled" }`
 * — então só precisamos subtrair os PARCIAIS.
 */

import prisma from "./prisma"

export interface RefundedTotals {
  /** Soma dos refund.amount */
  amount: number
  /** Soma dos refund.costRefunded (pode ser 0 se nenhum refund tinha productCost) */
  costRefunded: number
}

const EMPTY: RefundedTotals = { amount: 0, costRefunded: 0 }

/**
 * Mapa de refunds parciais por billId. Refunds totais são ignorados —
 * a Bill já está com status="cancelled" e fora das queries de venda.
 */
export async function getPartialRefundsForBills(
  tenantId: string,
  billIds: string[],
): Promise<Map<string, RefundedTotals>> {
  if (billIds.length === 0) return new Map()
  const refunds = await prisma.billRefund.findMany({
    where: {
      tenantId,
      billId: { in: billIds },
      source: "ml_partial_refund",
    },
    select: { billId: true, amount: true, costRefunded: true },
  })
  const map = new Map<string, RefundedTotals>()
  for (const r of refunds) {
    const cur = map.get(r.billId) ?? { amount: 0, costRefunded: 0 }
    cur.amount += r.amount
    cur.costRefunded += r.costRefunded ?? 0
    map.set(r.billId, cur)
  }
  return map
}

/**
 * Versão "agregada": soma TODOS os refunds parciais do tenant em um período
 * (sem ligar à bill). Útil pra subtrair direto de um total em queries que
 * já agregaram.
 */
export async function sumPartialRefundsInPeriod(
  tenantId: string,
  start: Date,
  end: Date,
  billIds?: string[],
): Promise<RefundedTotals> {
  const refunds = await prisma.billRefund.findMany({
    where: {
      tenantId,
      source: "ml_partial_refund",
      refundedAt: { gte: start, lt: end },
      ...(billIds ? { billId: { in: billIds } } : {}),
    },
    select: { amount: true, costRefunded: true },
  })
  let amount = 0
  let costRefunded = 0
  for (const r of refunds) {
    amount += r.amount
    costRefunded += r.costRefunded ?? 0
  }
  return { amount, costRefunded }
}

/** Lê o refund de uma bill ou retorna zero. */
export function refundOf(map: Map<string, RefundedTotals>, billId: string): RefundedTotals {
  return map.get(billId) ?? EMPTY
}
