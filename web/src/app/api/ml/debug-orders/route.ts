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

    // Buscar detalhes de envio
    let shippingDetail = null;
    if (orderDetail.shipping?.id) {
      try {
        const shippingResponse = await fetch(
          `https://api.mercadolibre.com/shipments/${orderDetail.shipping.id}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        if (shippingResponse.ok) {
          shippingDetail = await shippingResponse.json();
        }
      } catch (error) {
        console.error('Erro ao buscar detalhes de envio:', error);
      }
    }

    // Retornar estrutura completa para debug
    return NextResponse.json({
      message: 'Debug info for first order',
      orderId: order.id,
      summary: {
        total_amount: orderDetail.total_amount,
        sale_fees: orderDetail.order_items?.map((item: any) => ({
          item: item.item.title,
          sale_fee: item.sale_fee,
        })),
      },
      shippingInfo: {
        shippingId: orderDetail.shipping?.id,
        shippingDetail: shippingDetail,
      },
      paymentInfo: {
        payments: orderDetail.payments?.map((p: any) => ({
          status: p.status,
          marketplace_fee: p.marketplace_fee,
          shipping_cost: p.shipping_cost,
          transaction_amount: p.transaction_amount,
        })),
      },
      fullOrder: orderDetail,
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Debug failed', details: String(error) },
      { status: 500 }
    );
  }
}
