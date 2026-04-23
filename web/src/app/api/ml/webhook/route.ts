/**
 * Webhook do Mercado Livre
 * Recebe notificações quando produtos são criados/atualizados/deletados
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { syncMLProductToDB } from '@/lib/auto-sync-ml'

export const dynamic = 'force-dynamic'

interface MLWebhookPayload {
  resource: string // "/items/ITEM_ID" ou similar
  user_id: number
  topic: string // "item", "order", etc
  application_id: number
  timestamp: string
  sent: number
  attempt: number
}

/**
 * POST /api/ml/webhook
 * Recebe notificações do Mercado Livre
 *
 * Tópicos possíveis:
 * - item - produto.criado/atualizado
 * - order - pedido.criado/atualizado
 * - payment - pagamento.criado/atualizado
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MLWebhookPayload

    console.log('[WEBHOOK] Notificação recebida:', {
      topic: body.topic,
      resource: body.resource,
      user_id: body.user_id,
      timestamp: new Date(body.timestamp).toISOString(),
    })

    // Localizar tenant dono do sellerID (multi-tenant safe)
    const integration = await prisma.mLIntegration.findFirst({
      where: { sellerID: body.user_id.toString() },
    })
    if (!integration) {
      console.warn('[WEBHOOK] Notificação de seller desconhecido:', body.user_id)
      return NextResponse.json({ error: 'Seller não reconhecido' }, { status: 403 })
    }

    // Processar conforme o tópico
    switch (body.topic) {
      case 'item': {
        await handleItemUpdate(body, integration)
        break
      }

      case 'order': {
        // Aqui você pode adicionar lógica para pedidos
        console.log('[WEBHOOK] Pedido atualizado:', body.resource)
        break
      }

      case 'payment': {
        // Aqui você pode adicionar lógica para pagamentos
        console.log('[WEBHOOK] Pagamento atualizado:', body.resource)
        break
      }

      default:
        console.log('[WEBHOOK] Tópico desconhecido:', body.topic)
    }

    // Responder rápido ao ML (não pode levar mais de 5s)
    return NextResponse.json(
      { status: 'received', processed: true },
      { status: 200 }
    )
  } catch (error) {
    console.error('[WEBHOOK] Erro ao processar notificação:', error)
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 500 }
    )
  }
}

/**
 * Processa atualização de item
 * Extrai ID do resource string: "/items/MLB12345678"
 */
async function handleItemUpdate(
  body: MLWebhookPayload,
  integration: any
) {
  try {
    // Extrair ID do produto
    const itemId = body.resource.split('/').pop()
    if (!itemId) {
      console.warn('[WEBHOOK] ID do produto não encontrado em:', body.resource)
      return
    }

    console.log('[WEBHOOK] Processando atualização do item:', itemId)

    // Buscar detalhes do produto no ML
    const itemResponse = await fetch(
      `https://api.mercadolibre.com/items/${itemId}`,
      {
        headers: { Authorization: `Bearer ${integration.accessToken}` },
      }
    )

    if (!itemResponse.ok) {
      console.error(
        '[WEBHOOK] Erro ao buscar detalhes do item:',
        itemResponse.statusText
      )
      return
    }

    const mlProduct = await itemResponse.json()

    // Sincronizar para o banco
    const result = await syncMLProductToDB(mlProduct)

    if (result.success) {
      console.log('[WEBHOOK] Produto sincronizado com sucesso:', itemId)
    } else {
      console.error('[WEBHOOK] Erro ao sincronizar:', result.error)
    }
  } catch (error) {
    console.error('[WEBHOOK] Erro no handleItemUpdate:', error)
  }
}

/**
 * GET /api/ml/webhook
 * ML faz uma requisição GET para validar o webhook
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const challenge = searchParams.get('challenge')

    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge não fornecido' },
        { status: 400 }
      )
    }

    console.log('[WEBHOOK] Validação de webhook recebida')

    // ML espera um JSON com o challenge ecoado
    return NextResponse.json({ challenge })
  } catch (error) {
    console.error('[WEBHOOK] Erro na validação:', error)
    return NextResponse.json({ error: 'Erro na validação' }, { status: 500 })
  }
}
