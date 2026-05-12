import prisma from "@/lib/prisma"
import { formatVariationLabel } from "@/lib/ml-format"
import { resolveCostsBatch, costKey } from "@/lib/cost-resolver"
import { createNotification } from "@/lib/notifications"
import { captureError } from "@/lib/sentry"
import { sendPushToTenant } from "@/lib/push"
import { loggedFetch } from "@/lib/api-log"

interface MLOrderItem {
  item: {
    id: string
    title: string
    variation_id?: string | number | null
    variation_attributes?: Array<{
      id?: string
      name: string
      value_name: string
    }>
  }
  quantity: number
  unit_price: number
  sale_fee?: number
}

interface MLOrder {
  id: number
  pack_id?: number | null
  status: string
  date_created: string
  date_closed: string
  total_amount: number
  shipping: { id?: string; cost: number }
  buyer: { id: number; nickname: string }
  order_items: MLOrderItem[]
  payments?: Array<{ id: number | string }>
}

export type SyncOrderAction =
  | "created"
  | "updated-cancelled"
  | "skipped"
  | "ignored"
  | "error"

export interface SyncOrderResult {
  ok: boolean
  action: SyncOrderAction
  billId?: string
  error?: string
}

const SALE_FEE_PCT = 0.18

/**
 * Busca um pedido do ML e faz upsert como Bill receivable.
 * Usado pelo webhook (1 pedido por vez) e pelo cron (em loop).
 *
 * Idempotente: se a bill já existe (mlOrderId="order_${id}"), só atualiza
 * em caso de cancelamento. Caso contrário, cria nova com líquido, taxas
 * em notes, productCost resolvido via cost-resolver.
 */
async function fetchMPNet(paymentId: number | string, mpToken: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}`, Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const net: unknown = data?.transaction_details?.net_received_amount
    return typeof net === 'number' && net > 0 ? net : null
  } catch {
    return null
  }
}

export async function syncMLOrder(params: {
  tenantId: string
  accessToken: string
  orderId: string | number
  mpAccessToken?: string
}): Promise<SyncOrderResult> {
  const { tenantId, accessToken, orderId } = params

  try {
    const orderRes = await loggedFetch(`https://api.mercadolibre.com/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      provider: "ml",
      tenantId,
      endpoint: "/orders/{id}",
    })
    if (!orderRes.ok) {
      return { ok: false, action: "error", error: `ML /orders/${orderId} → ${orderRes.status}` }
    }
    const order = (await orderRes.json()) as MLOrder

    const isCancelled = order.status === "cancelled"
    const mlOrderId = `order_${order.id}`

    const existing = await prisma.bill.findUnique({
      where: { mlOrderId },
      include: { refunds: { where: { source: "ml_order_cancelled" }, select: { id: true } } },
    })
    if (existing) {
      if (isCancelled && existing.status !== "cancelled") {
        // Cria refund total (se ainda não existe) E marca status cancelled
        // como atalho de compat. Bill.amount fica intacta — auditoria.
        if (existing.refunds.length === 0) {
          await prisma.billRefund.create({
            data: {
              billId: existing.id,
              tenantId,
              amount: existing.amount,
              costRefunded: existing.productCost,
              source: "ml_order_cancelled",
              mlOrderId,
              mlPaymentId: null,
            },
          })
        }
        const updated = await prisma.bill.update({
          where: { id: existing.id },
          data: { status: "cancelled" },
        })
        const formatBRL = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format
        await createNotification({
          tenantId,
          type: "refund",
          title: `Venda cancelada: ${formatBRL(existing.amount)}`,
          body: `Pedido ML #${order.id} · ${order.buyer?.nickname || ""}`.trim(),
          link: `/admin/financeiro/devolucoes`,
        })
        return { ok: true, action: "updated-cancelled", billId: updated.id }
      }
      return { ok: true, action: "skipped", billId: existing.id }
    }

    if (isCancelled && !order.total_amount) {
      return { ok: true, action: "ignored" }
    }

    const firstItem = order.order_items?.[0]?.item
    const itemTitle = firstItem?.title || "Venda Mercado Livre"
    const itemId = firstItem?.id || ""
    const variationLabel = formatVariationLabel(firstItem?.variation_attributes)
    const displayTitle = variationLabel ? `${itemTitle} · ${variationLabel}` : itemTitle
    const closedDate = new Date(order.date_closed || order.date_created)

    let saleFee = 0
    let saleFeeEstimated = false
    if (order.order_items && order.order_items.length > 0) {
      saleFee = order.order_items.reduce(
        (sum, item) => sum + (Number(item.sale_fee) || 0) * (Number(item.quantity) || 1),
        0,
      )
    }
    if (saleFee === 0 && order.total_amount) {
      saleFee = order.total_amount * SALE_FEE_PCT
      saleFeeEstimated = true
    }

    // Pack-anchor: quando o cliente compra N anúncios no mesmo carrinho, o ML
    // emite um shipment único mas cria N pedidos. Se já existe Bill desse pack
    // no tenant, ela é a âncora — só ela carrega o frete; pedidos seguintes
    // ficam com shippingFee=0 pra não contar o mesmo envio múltiplas vezes.
    let isShippingAnchor = true
    if (order.pack_id) {
      const existingInPack = await prisma.bill.count({
        where: {
          tenantId,
          type: "receivable",
          category: "venda",
          mlPackId: String(order.pack_id),
        },
      })
      if (existingInPack > 0) isShippingAnchor = false
    }

    let shippingFee = 0
    if (isShippingAnchor && order.shipping?.id) {
      try {
        const shippingRes = await loggedFetch(
          `https://api.mercadolibre.com/shipments/${order.shipping.id}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            provider: "ml",
            tenantId,
            endpoint: "/shipments/{id}",
          },
        )
        if (shippingRes.ok) {
          const detail = await shippingRes.json()
          // seller_fee = list_cost - buyer_cost - ml_compensation
          // "Bônus por Envio": cost=0 E compensation=list_cost → seller_fee=0
          // Comprador paga frete: cost=list_cost, compensation=0 → seller_fee=0
          // Vendedor absorve frete grátis: cost=0, compensation=0 → seller_fee=list_cost
          const listCost: number = detail.shipping_option?.list_cost ?? 0
          const cost: number = detail.shipping_option?.cost ?? 0
          const compensation: number = detail.cost_components?.compensation ?? 0
          shippingFee = Math.max(0, listCost - cost - compensation)
        }
      } catch (err) {
        console.error(`[ml-order-sync] shipping fetch falhou para ${order.id}:`, err)
      }
    }

    // Tenta obter o net real do MP (mais preciso que o calculado pelos
    // componentes do ML, que às vezes omitem bônus/descontos de frete).
    let finalShippingFee = shippingFee
    let finalNetAmount = order.total_amount - saleFee - shippingFee
    let shippingBonus = 0
    if (params.mpAccessToken && order.payments?.[0]?.id) {
      const mpNet = await fetchMPNet(order.payments[0].id, params.mpAccessToken)
      if (mpNet !== null && Math.abs(mpNet - finalNetAmount) > 0.01) {
        const correctedShipping = Math.max(0, order.total_amount - saleFee - mpNet)
        shippingBonus = Math.max(0, finalShippingFee - correctedShipping)
        finalShippingFee = correctedShipping
        finalNetAmount = mpNet
      }
    }

    const totalTaxes = saleFee + finalShippingFee
    const saleFeeSuffix = saleFeeEstimated ? " (est.)" : ""
    const taxBreakdown = [
      saleFee > 0 ? `Taxa de venda: R$ ${saleFee.toFixed(2)}${saleFeeSuffix}` : "",
      finalShippingFee > 0 ? `Taxa de envio: R$ ${finalShippingFee.toFixed(2)}` : "",
    ]
      .filter(Boolean)
      .join(" + ")

    const packLine = order.pack_id ? `\nPack\n#${order.pack_id}\n` : ""
    const variationLine = variationLabel ? `\nVariação\n${variationLabel}\n` : ""
    const bonusLine = shippingBonus > 0.01 ? `\nBônus envio: R$ ${shippingBonus.toFixed(2)}` : ""
    const notesContent = `PEDIDO
#${order.id}
${packLine}
Comprador
${order.buyer.nickname}

Produto
${itemId}
${variationLine}
VENDAS
Bruto: R$ ${order.total_amount.toFixed(2)} | Taxas: ${taxBreakdown} (Total: R$ ${totalTaxes.toFixed(2)}) | Líquido: R$ ${finalNetAmount.toFixed(2)}${bonusLine}`

    const quantity =
      (order.order_items || []).reduce((sum, oi) => sum + (Number(oi.quantity) || 1), 0) || 1

    const costItems = (order.order_items || [])
      .filter((oi) => !!oi.item?.id)
      .map((oi) => ({
        mlListingId: oi.item.id,
        variationId: oi.item?.variation_id ?? null,
      }))
    const costs = await resolveCostsBatch({ tenantId, items: costItems })

    let productCost: number | null = null
    for (const oi of order.order_items || []) {
      const oiId = oi.item?.id
      const oiQty = Number(oi.quantity) || 1
      if (!oiId) continue
      const resolved = costs.get(costKey(oiId, oi.item?.variation_id ?? null))
      if (resolved && resolved.cost != null) {
        productCost = (productCost ?? 0) + resolved.cost * oiQty
      }
    }

    const firstVariationId = firstItem?.variation_id ? String(firstItem.variation_id) : null
    const estimatedReleaseDate = new Date(closedDate)
    estimatedReleaseDate.setDate(estimatedReleaseDate.getDate() + 30)

    const saleBill = await prisma.bill.create({
      data: {
        type: "receivable",
        category: "venda",
        description: `Venda ML - ${displayTitle} [Produto ML: ${itemId || "sem-id"}]`,
        amount: finalNetAmount,
        dueDate: estimatedReleaseDate,
        paidDate: closedDate,
        status: isCancelled ? "cancelled" : "pending",
        mlOrderId,
        mlPackId: order.pack_id ? String(order.pack_id) : null,
        mlVariationId: firstVariationId,
        notes: `PRODUTO ML ID: ${itemId || "SEM ID"}\n\n${notesContent}`,
        productId: null,
        productCost,
        quantity,
        tenantId,
      },
    })

    // Bill nova já chegou cancelada — registra refund correspondente
    // pra refletir na receita líquida do DRE.
    if (isCancelled) {
      await prisma.billRefund.create({
        data: {
          billId: saleBill.id,
          tenantId,
          amount: finalNetAmount,
          costRefunded: productCost,
          source: "ml_order_cancelled",
          mlOrderId,
          mlPaymentId: null,
        },
      })
    }

    if (!isCancelled) {
      const formatBRL = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format
      const title = `Venda nova: ${formatBRL(order.total_amount)}`
      const body = `${displayTitle} · ${order.buyer.nickname}`
      const link = `/admin/relatorios/vendas-ml`

      await createNotification({ tenantId, type: "sale", title, body, link })
      // Push notification (PWA): inerte se ninguém ativou no device.
      void sendPushToTenant(tenantId, { title, body, url: link })
    }

    return { ok: true, action: "created", billId: saleBill.id }
  } catch (err) {
    captureError(err, {
      tenantId,
      operation: "ml-order-sync",
      extra: { orderId },
    })
    return {
      ok: false,
      action: "error",
      error: err instanceof Error ? err.message : "erro desconhecido",
    }
  }
}
