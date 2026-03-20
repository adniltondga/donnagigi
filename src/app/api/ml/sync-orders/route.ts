import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// Função para renovar token se expirou
async function refreshTokenIfNeeded() {
  const integration = await prisma.mLIntegration.findFirst();

  if (!integration) {
    throw new Error('Mercado Livre not configured');
  }

  // Verificar se token expirou
  if (new Date() <= integration.expiresAt) {
    return integration; // Token ainda é válido
  }

  // Token expirou, tentar renovar com refreshToken
  if (!integration.refreshToken) {
    throw new Error('Mercado Livre token expired and refresh token not available');
  }

  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Mercado Livre credentials not configured');
  }

  const tokenUrl = 'https://api.mercadolibre.com/oauth/token';

  const tokenParams = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: integration.refreshToken,
  });

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    body: tokenParams.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh Mercado Livre token');
  }

  const tokenData = await tokenResponse.json();

  // Atualizar no banco
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

  const updatedIntegration = await prisma.mLIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || integration.refreshToken,
      expiresAt: expiresAt,
    },
  });

  console.log('✅ Mercado Livre token renovado com sucesso');
  return updatedIntegration;
}

interface MLOrder {
  id: number;
  status: string;
  date_created: string;
  date_closed: string;
  total_amount: number;
  shipping: {
    cost: number;
  };
  buyer: {
    id: number;
    nickname: string;
  };
  order_items: Array<{
    item: {
      id: string;
      title: string;
    };
    quantity: number;
    unit_price: number;
  }>;
}

interface MLOrdersResponse {
  results: MLOrder[];
  paging: {
    total: number;
    limit: number;
    offset: number;
  };
}

export async function GET(req: NextRequest) {
  try {
    // Obter integração e renovar token se necessário
    const integration = await refreshTokenIfNeeded();

    const sellerId = integration.sellerID;
    const accessToken = integration.accessToken;

    // Buscar pedidos pagos do Mercado Livre
    const mlResponse = await fetch(
      `https://api.mercadolibre.com/orders/search?seller=${sellerId}&order.status=paid&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!mlResponse.ok) {
      const error = await mlResponse.json();
      console.error('ML API error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch orders from Mercado Livre' },
        { status: 500 }
      );
    }

    const data: MLOrdersResponse = await mlResponse.json();
    const orders = data.results || [];

    let created = 0;
    let skipped = 0;
    const createdBills = [];

    // Processar cada pedido
    for (const order of orders) {
      // Verificar se já foi importado
      const existing = await prisma.bill.findUnique({
        where: { mlOrderId: `order_${order.id}` },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Extrair informações do pedido
      const itemTitle =
        order.order_items?.[0]?.item?.title || 'Venda Mercado Livre';
      const orderDate = new Date(order.date_closed || order.date_created);
      const closedDate = new Date(order.date_closed || order.date_created);

      // Criar conta a receber (venda)
      const saleBill = await prisma.bill.create({
        data: {
          type: 'receivable',
          category: 'venda',
          description: `Venda ML - ${itemTitle}`,
          amount: order.total_amount,
          dueDate: orderDate,
          paidDate: closedDate,
          status: 'paid',
          mlOrderId: `order_${order.id}`,
          notes: `Pedido Mercado Livre #${order.id} - Comprador: ${order.buyer.nickname}`,
        },
        include: { supplier: true },
      });

      created++;
      createdBills.push(saleBill);

      // Criar conta a pagar (taxa do ML - 13% médio)
      const fee = order.total_amount * 0.13;
      const feeBill = await prisma.bill.create({
        data: {
          type: 'payable',
          category: 'marketplace_fee',
          description: `Taxa ML - ${itemTitle}`,
          amount: fee,
          dueDate: orderDate,
          paidDate: closedDate,
          status: 'paid',
          mlOrderId: `fee_${order.id}`,
          notes: `Taxa de marketplace referente ao pedido #${order.id}`,
        },
        include: { supplier: true },
      });

      createdBills.push(feeBill);
    }

    return NextResponse.json({
      success: true,
      message: `Sincronização concluída: ${created} pedidos importados, ${skipped} já existiam`,
      stats: {
        total: orders.length,
        created,
        skipped,
      },
      bills: createdBills.slice(0, 10), // Retornar apenas os 10 primeiros
    });
  } catch (error) {
    console.error('Error syncing orders:', error);
    return NextResponse.json(
      { error: 'Failed to sync orders' },
      { status: 500 }
    );
  }
}
