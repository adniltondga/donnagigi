import prisma from "@/lib/prisma"
import { formatVariationLabel } from "@/lib/ml-format"
import { resolveCostsBatch, costKey } from "@/lib/cost-resolver"
import { createNotification } from "@/lib/notifications"
import { captureError } from "@/lib/sentry"

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
export async function syncMLOrder(params: {
  tenantId: string
  accessToken: string
  orderId: string | number
}): Promise<SyncOrderResult> {
  const { tenantId, accessToken, orderId } = params

  try {
    const orderRes = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!orderRes.ok) {
      return { ok: false, action: "error", error: `ML /orders/${orderId} → ${orderRes.status}` }
    }
    const order = (await orderRes.json()) as MLOrder

    const isCancelled = order.status === "cancelled"
    const mlOrderId = `order_${order.id}`

    const existing = await prisma.bill.findUnique({ where: { mlOrderId } })
    if (existing) {
      if (isCancelled && existing.status !== "cancelled") {
        const refundNote = `\n\nDevolução detectada em ${new Date().toLocaleDateString("pt-BR")} (order cancelled)`
        const updated = await prisma.bill.update({
          where: { id: existing.id },
          data: { status: "cancelled", notes: (existing.notes || "") + refundNote },
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
          link: `/admin/relatorios/vendas-ml`,
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

    let shippingFee = 0
    if (order.shipping?.id) {
      try {
        const shippingRes = await fetch(
          `https://api.mercadolibre.com/shipments/${order.shipping.id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        if (shippingRes.ok) {
          const detail = await shippingRes.json()
          const listCost = detail.shipping_option?.list_cost || 0
          const subsidizedCost = detail.shipping_option?.cost || 0
          shippingFee = listCost - subsidizedCost
        }
      } catch (err) {
        console.error(`[ml-order-sync] shipping fetch falhou para ${order.id}:`, err)
      }
    }

    const totalTaxes = saleFee + shippingFee
    const netAmount = order.total_amount - totalTaxes
    const saleFeeSuffix = saleFeeEstimated ? " (est.)" : ""
    const taxBreakdown = [
      saleFee > 0 ? `Taxa de venda: R$ ${saleFee.toFixed(2)}${saleFeeSuffix}` : "",
      shippingFee > 0 ? `Taxa de envio: R$ ${shippingFee.toFixed(2)}` : "",
    ]
      .filter(Boolean)
      .join(" + ")

    const packLine = order.pack_id ? `\nPack\n#${order.pack_id}\n` : ""
    const variationLine = variationLabel ? `\nVariação\n${variationLabel}\n` : ""
    const notesContent = `PEDIDO
#${order.id}
${packLine}
Comprador
${order.buyer.nickname}

Produto
${itemId}
${variationLine}
VENDAS
Bruto: R$ ${order.total_amount.toFixed(2)} | Taxas: ${taxBreakdown} (Total: R$ ${totalTaxes.toFixed(2)}) | Líquido: R$ ${netAmount.toFixed(2)}`

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

    const cancelledSuffix = isCancelled
      ? `\n\nDevolução detectada em ${new Date().toLocaleDateString("pt-BR")} (order cancelled no ML)`
      : ""

    const saleBill = await prisma.bill.create({
      data: {
        type: "receivable",
        category: "venda",
        description: `Venda ML - ${displayTitle} [Produto ML: ${itemId || "sem-id"}]`,
        amount: netAmount,
        dueDate: estimatedReleaseDate,
        paidDate: closedDate,
        status: isCancelled ? "cancelled" : "pending",
        mlOrderId,
        mlPackId: order.pack_id ? String(order.pack_id) : null,
        mlVariationId: firstVariationId,
        notes: `PRODUTO ML ID: ${itemId || "SEM ID"}\n\n${notesContent}${cancelledSuffix}`,
        productId: null,
        productCost,
        quantity,
        tenantId,
      },
    })

    if (!isCancelled) {
      const formatBRL = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format
      await createNotification({
        tenantId,
        type: "sale",
        title: `Venda nova: ${formatBRL(order.total_amount)}`,
        body: `${displayTitle} · ${order.buyer.nickname}`,
        link: `/admin/relatorios/vendas-ml`,
      })
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
