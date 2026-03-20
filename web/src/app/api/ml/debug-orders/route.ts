import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const integration = await prisma.mLIntegration.findFirst();

    if (!integration || !integration.accessToken) {
      return NextResponse.json(
        { error: 'Mercado Livre not configured' },
        { status: 400 }
      );
    }

    const sellerId = integration.sellerID;
    const accessToken = integration.accessToken;

    // Buscar um pedido
    const mlResponse = await fetch(
      `https://api.mercadolibre.com/orders/search?seller=${sellerId}&order.status=paid&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!mlResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    const data = await mlResponse.json();
    const order = data.results?.[0];

    if (!order) {
      return NextResponse.json(
        { message: 'No orders found', data: data },
        { status: 200 }
      );
    }

    // Buscar detalhes completos
    const detailResponse = await fetch(
      `https://api.mercadolibre.com/orders/${order.id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const orderDetail = await detailResponse.json();

    // Retornar estrutura completa para debug
    return NextResponse.json({
      message: 'Debug info for first order',
      orderId: order.id,
      summary: {
        total_amount: orderDetail.total_amount,
        shipping_cost: orderDetail.shipping?.cost,
      },
      fullOrder: orderDetail,
      // Procurar por campos de taxa
      taxFields: {
        charges: orderDetail.charges,
        fees: orderDetail.fees,
        item_fees: orderDetail.item_fees,
        marketplace_fees: orderDetail.marketplace_fees,
        'Order Details': Object.keys(orderDetail).filter(k => k.includes('fee') || k.includes('charge')),
      },
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Debug failed', details: String(error) },
      { status: 500 }
    );
  }
}
