/**
 * Webhook do Mercado Livre — recebe notificações em tempo real.
 *
 * Tópicos suportados:
 *  - item / items        → sincroniza produto
 *  - order / orders_v2   → sincroniza venda (puxa detalhe da API e cria Bill)
 *  - payment / payments  → log por ora (liberações vão por release-and-refunds)
 *
 * O ML exige resposta em <5s. Toda a lógica pesada é chamada, mas
 * retornamos 200 rapidamente mesmo em caso de erro parcial, pra evitar
 * retry tempestade (ML reenvia com backoff exponencial).
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { syncMLProductToDB } from "@/lib/auto-sync-ml"
import { syncMLOrder } from "@/lib/ml-order-sync"
import { getMLIntegrationForTenant } from "@/lib/ml"

export const dynamic = "force-dynamic"

interface MLWebhookPayload {
  resource: string // ex: "/items/MLB12345", "/orders/12345"
  user_id: number
  topic: string
  application_id: number
  timestamp: string
  sent: number
  attempt: number
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MLWebhookPayload

    console.log("[ml-webhook]", {
      topic: body.topic,
      resource: body.resource,
      user_id: body.user_id,
      attempt: body.attempt,
    })

    const integration = await prisma.mLIntegration.findFirst({
      where: { sellerID: body.user_id.toString() },
      select: { id: true, tenantId: true, accessToken: true, sellerID: true },
    })
    if (!integration) {
      console.warn("[ml-webhook] seller desconhecido:", body.user_id)
      return NextResponse.json({ error: "Seller não reconhecido" }, { status: 403 })
    }

    const resourceId = extractResourceId(body.resource)
    const topic = body.topic

    if (topic === "items" || topic === "item") {
      if (resourceId) await handleItemUpdate(resourceId, integration.accessToken, integration.tenantId)
    } else if (topic === "orders_v2" || topic === "order" || topic === "orders") {
      if (resourceId) await handleOrderUpdate(resourceId, integration.tenantId)
    } else if (topic === "payments" || topic === "payment") {
      console.log("[ml-webhook] payment notification (ignorado, release-and-refunds cuida)")
    } else {
      console.log("[ml-webhook] tópico desconhecido:", topic)
    }

    return NextResponse.json({ status: "received" }, { status: 200 })
  } catch (err) {
    console.error("[ml-webhook] erro:", err)
    return NextResponse.json({ error: "erro ao processar" }, { status: 500 })
  }
}

function extractResourceId(resource: string): string | null {
  if (!resource) return null
  const parts = resource.split("/").filter(Boolean)
  return parts[parts.length - 1] || null
}

async function handleItemUpdate(itemId: string, accessToken: string, tenantId: string) {
  try {
    const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      console.error(`[ml-webhook] item ${itemId} → ${res.status}`)
      return
    }
    const mlProduct = await res.json()
    const result = await syncMLProductToDB(mlProduct, tenantId)
    if (!result.success) {
      console.error(`[ml-webhook] syncMLProductToDB falhou:`, result.error)
    }
  } catch (err) {
    console.error(`[ml-webhook] handleItemUpdate erro:`, err)
  }
}

async function handleOrderUpdate(orderId: string, tenantId: string) {
  // Precisamos do token via helper pra garantir refresh automático caso expire.
  const integration = await getMLIntegrationForTenant(tenantId)
  if (!integration) {
    console.error(`[ml-webhook] order ${orderId} sem integração válida`)
    return
  }
  const result = await syncMLOrder({
    tenantId,
    accessToken: integration.accessToken,
    orderId,
  })
  if (!result.ok) {
    console.error(`[ml-webhook] syncMLOrder falhou:`, result.error)
  } else {
    console.log(`[ml-webhook] order ${orderId} → ${result.action}`)
  }
}

/**
 * GET /api/ml/webhook — ML faz handshake com ?challenge=XYZ na hora de
 * registrar a URL no DevCenter. Devolvemos o challenge ecoado.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const challenge = searchParams.get("challenge")
    if (!challenge) {
      return NextResponse.json({ error: "Challenge não fornecido" }, { status: 400 })
    }
    return NextResponse.json({ challenge })
  } catch (err) {
    console.error("[ml-webhook] erro na validação:", err)
    return NextResponse.json({ error: "erro na validação" }, { status: 500 })
  }
}
