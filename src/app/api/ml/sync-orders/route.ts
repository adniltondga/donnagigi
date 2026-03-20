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
  // Taxas cobradas pelo ML
  charges?: Array<{
    type: string;
    amount: number;
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
    let orders = data.results || [];

    // Buscar detalhes completos de cada pedido (para pegar as taxas reais)
    console.log(`📦 Buscando detalhes de ${orders.length} pedidos...`);
    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        try {
          const detailResponse = await fetch(
            `https://api.mercadolibre.com/orders/${order.id}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
          if (detailResponse.ok) {
            return await detailResponse.json();
          }
          return order;
        } catch (error) {
          console.error(`Erro ao buscar detalhes do pedido ${order.id}:`, error);
          return order;
        }
      })
    );
    orders = ordersWithDetails;

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

      // Extrair taxas reais do ML
      // As taxas vêm em order_items[].sale_fee
      let totalFee = 0;
      let feeDetails = '';

      if (order.order_items && order.order_items.length > 0) {
        // Somar sale_fee de todos os itens
        totalFee = order.order_items.reduce((sum: number, item: any) => {
          return sum + (item.sale_fee || 0);
        }, 0);

        if (totalFee > 0) {
          feeDetails = `Sale Fee: R$ ${totalFee.toFixed(2)}`;
        }
      }

      // Fallback: se não tem sale_fee, tentar outros campos
      if (totalFee === 0) {
        // Tentar marketplace_fee do payment
        if (order.payments && order.payments.length > 0) {
          totalFee = order.payments.reduce((sum: number, payment: any) => {
            return sum + (payment.marketplace_fee || 0);
          }, 0);
          if (totalFee > 0) {
            feeDetails = 'Marketplace Fee (payment)';
          }
        }

        // Se ainda não tem, usar cálculo aproximado
        if (totalFee === 0 && order.total_amount) {
          totalFee = order.total_amount * 0.13;
          feeDetails = 'Cálculo aproximado (13%)';
        }
      }

      // Criar bill de taxa de venda se houver valor
      if (totalFee > 0) {
        const feeBill = await prisma.bill.create({
          data: {
            type: 'payable',
            category: 'marketplace_fee',
            description: `Taxa ML (Venda) - ${itemTitle}`,
            amount: totalFee,
            dueDate: orderDate,
            paidDate: closedDate,
            status: 'paid',
            mlOrderId: `fee_${order.id}`,
            notes: `Taxa de marketplace de venda: ${feeDetails}`,
          },
          include: { supplier: true },
        });

        createdBills.push(feeBill);
      }

      // Extrair taxa de envio (list_cost)
      let shippingFee = 0;
      if (order.shipping?.list_cost) {
        shippingFee = order.shipping.list_cost;
      }

      // Criar bill de taxa de envio se houver valor
      if (shippingFee > 0) {
        const shippingBill = await prisma.bill.create({
          data: {
            type: 'payable',
            category: 'marketplace_fee',
            description: `Taxa ML (Envio) - ${itemTitle}`,
            amount: shippingFee,
            dueDate: orderDate,
            paidDate: closedDate,
            status: 'paid',
            mlOrderId: `shipping_${order.id}`,
            notes: `Taxa de envio cobrada pelo ML: R$ ${shippingFee.toFixed(2)}`,
          },
          include: { supplier: true },
        });

        createdBills.push(shippingBill);
      }
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
