import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const orderId = searchParams.get('orderId');

    const integration = await prisma.mLIntegration.findFirst();

    if (!integration || !integration.accessToken) {
      return NextResponse.json(
        { error: 'Mercado Livre not configured' },
        { status: 400 }
      );
    }

    const sellerId = integration.sellerID;
    const accessToken = integration.accessToken;

    let order;

    if (orderId) {
      // Buscar um pedido específico
      const detailResponse = await fetch(
        `https://api.mercadolibre.com/orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!detailResponse.ok) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        );
      }

      order = await detailResponse.json();
    } else {
      // Buscar o primeiro pedido
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
      order = data.results?.[0];

      if (!order) {
        return NextResponse.json(
          { message: 'No orders found', data: data },
          { status: 200 }
        );
      }
    }

    // Buscar detalhes de envio
    let shippingDetail = null;
    if (order.shipping?.id) {
      try {
        const shippingResponse = await fetch(
          `https://api.mercadolibre.com/shipments/${order.shipping.id}`,
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
      message: 'Debug info',
      orderId: order.id,
      shippingDetail: {
        base_cost: shippingDetail?.base_cost,
        list_cost: shippingDetail?.shipping_option?.list_cost,
        cost: shippingDetail?.shipping_option?.cost,
        cost_components: shippingDetail?.cost_components,
      },
      fullShippingDetail: shippingDetail,
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Debug failed', details: String(error) },
      { status: 500 }
    );
  }
}
