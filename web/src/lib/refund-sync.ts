/**
 * Detecção de devoluções via API do ML — função pura reutilizável
 * pelo cron diário (release-and-refunds) e pelo endpoint manual de
 * sincronização (devolucoes/sync).
 *
 * A bill original NUNCA é mexida no amount. Refunds são linhas
 * separadas em BillRefund. Idempotência:
 *  - Refund total (cancelled): skip se já existe BillRefund com
 *    source=ml_order_cancelled.
 *  - Refund parcial: skip se já existe BillRefund com mesmo
 *    mlPaymentId.
 */

import prisma from "./prisma"

export interface RefundSyncResult {
  verificadas: number
  canceladas: number
  parciais: number
  jaProcessadas: number
  falhas: number
  totalDevolvido: number
}

interface MLPayment {
  id: number | string
  transaction_amount_refunded?: number
}

interface MLOrderCheck {
  status?: string
  payments?: MLPayment[]
}

interface SyncParams {
  tenantId: string
  accessToken: string
  /** Data inicial (paidDate da bill ≥ since). Default: 60 dias atrás. */
  since?: Date
}

/**
 * Roda detecção de devoluções pra um tenant. Retorna stats.
 */
export async function syncRefundsForTenant(params: SyncParams): Promise<RefundSyncResult> {
  const { tenantId, accessToken } = params
  const since =
    params.since ??
    (() => {
      const d = new Date()
      d.setDate(d.getDate() - 60)
      return d
    })()

  const headers = { Authorization: `Bearer ${accessToken}` }

  const bills = await prisma.bill.findMany({
    where: {
      tenantId,
      type: "receivable",
      category: "venda",
      mlOrderId: { not: null },
      paidDate: { gte: since },
      status: { in: ["pending", "paid"] },
    },
    select: {
      id: true,
      mlOrderId: true,
      amount: true,
      productCost: true,
      status: true,
      refunds: {
        select: { source: true, mlPaymentId: true, amount: true },
      },
    },
  })

  const stats: RefundSyncResult = {
    verificadas: bills.length,
    canceladas: 0,
    parciais: 0,
    jaProcessadas: 0,
    falhas: 0,
    totalDevolvido: 0,
  }

  type BillResult =
    | { kind: "falha" }
    | { kind: "sem-refund" }
    | { kind: "ja-processada" }
    | { kind: "cancelada"; amount: number }
    | { kind: "parcial"; refunded: number }

  const checkBill = async (b: (typeof bills)[number]): Promise<BillResult> => {
    const orderId = (b.mlOrderId || "").replace(/^order_/, "")
    try {
      const res = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, { headers })
      if (!res.ok) return { kind: "falha" }

      const order = (await res.json()) as MLOrderCheck
      const payments = order.payments || []
      const refunded = payments.reduce(
        (s, p) => s + (Number(p.transaction_amount_refunded) || 0),
        0,
      )
      const statusCancelled = order.status === "cancelled"

      if (refunded <= 0 && !statusCancelled) return { kind: "sem-refund" }

      if (statusCancelled || refunded >= b.amount) {
        const already = b.refunds.some((r) => r.source === "ml_order_cancelled")
        if (already) return { kind: "ja-processada" }

        const totalAmount = b.amount
        const costRefunded = b.productCost ?? null
        await prisma.billRefund.create({
          data: {
            billId: b.id,
            tenantId,
            amount: totalAmount,
            costRefunded,
            source: "ml_order_cancelled",
            mlOrderId: b.mlOrderId,
            mlPaymentId: null,
          },
        })
        if (b.status !== "cancelled") {
          await prisma.bill.update({ where: { id: b.id }, data: { status: "cancelled" } })
        }
        return { kind: "cancelada", amount: totalAmount }
      }

      const refundedPayments = payments.filter(
        (p) => Number(p.transaction_amount_refunded) > 0,
      )
      if (refundedPayments.length === 0) return { kind: "sem-refund" }

      let createdAny = false
      for (const p of refundedPayments) {
        const pid = String(p.id)
        const already = b.refunds.some(
          (r) => r.source === "ml_partial_refund" && r.mlPaymentId === pid,
        )
        if (already) continue
        const partial = Number(p.transaction_amount_refunded) || 0
        if (partial <= 0) continue
        const ratio = b.amount > 0 ? partial / b.amount : 0
        const costRefunded = b.productCost != null ? b.productCost * ratio : null
        await prisma.billRefund.create({
          data: {
            billId: b.id,
            tenantId,
            amount: partial,
            costRefunded,
            source: "ml_partial_refund",
            mlOrderId: b.mlOrderId,
            mlPaymentId: pid,
          },
        })
        createdAny = true
      }

      if (!createdAny) return { kind: "ja-processada" }
      return { kind: "parcial", refunded }
    } catch {
      return { kind: "falha" }
    }
  }

  // Batches paralelos. ML aceita ~10 requests concorrentes por token.
  const BATCH_SIZE = 10
  for (let i = 0; i < bills.length; i += BATCH_SIZE) {
    const batch = bills.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(checkBill))
    for (const r of results) {
      if (r.kind === "falha") stats.falhas++
      else if (r.kind === "ja-processada") stats.jaProcessadas++
      else if (r.kind === "cancelada") {
        stats.canceladas++
        stats.totalDevolvido += r.amount
      } else if (r.kind === "parcial") {
        stats.parciais++
        stats.totalDevolvido += r.refunded
      }
    }
  }

  return stats
}
