import prisma from '@/lib/prisma';
import { getDefaultTenantId } from '@/lib/tenant';
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
  pack_id?: number | null;
  status: string;
  date_created: string;
  date_closed: string;
  total_amount: number;
  shipping: {
    id?: string;
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
    sale_fee?: number;
  }>;
  // Taxas cobradas pelo ML
  charges?: Array<{
    type: string;
    amount: number;
  }>;
  payments?: Array<{
    marketplace_fee?: number;
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

    // Janela de datas: padrão = último mês. Override com ?months=N
    const monthsParam = req.nextUrl.searchParams.get('months');
    const months = Math.max(1, Number(monthsParam) || 1);

    const now = new Date();
    const from = new Date(now);
    from.setMonth(from.getMonth() - months);

    const fromIso = from.toISOString();
    const toIso = now.toISOString();

    // Buscar pedidos do ML (paid + cancelled) com paginação completa
    const PAGE_SIZE = 50;
    const STATUSES = ['paid', 'cancelled'];
    let orders: MLOrder[] = [];

    for (const status of STATUSES) {
      let offset = 0;
      let total = 0;
      while (true) {
        const url = new URL('https://api.mercadolibre.com/orders/search');
        url.searchParams.set('seller', String(sellerId));
        url.searchParams.set('order.status', status);
        url.searchParams.set('order.date_created.from', fromIso);
        url.searchParams.set('order.date_created.to', toIso);
        url.searchParams.set('sort', 'date_desc');
        url.searchParams.set('limit', String(PAGE_SIZE));
        url.searchParams.set('offset', String(offset));

        const mlResponse = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!mlResponse.ok) {
          const error = await mlResponse.json();
          console.error('ML API error:', error);
          return NextResponse.json(
            { error: 'Failed to fetch orders from Mercado Livre', detalhes: error },
            { status: 500 }
          );
        }

        const data: MLOrdersResponse = await mlResponse.json();
        const page = data.results || [];
        total = data.paging?.total ?? offset + page.length;
        orders = orders.concat(page);

        if (page.length < PAGE_SIZE || offset + page.length >= total) break;
        offset += PAGE_SIZE;
      }
    }

    console.log(`📦 Janela: ${fromIso} → ${toIso} | baixados: ${orders.length}`);

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
    let cancelledUpdated = 0;
    const createdBills = [];

    // Processar cada pedido
    for (const order of orders) {
      const isCancelled = order.status === 'cancelled';

      // Verificar se já foi importado
      const existing = await prisma.bill.findUnique({
        where: { mlOrderId: `order_${order.id}` },
      });

      if (existing) {
        // Se virou cancelled no ML e ainda não está marcado aqui, atualiza
        if (isCancelled && existing.status !== 'cancelled') {
          const refundNote = `\n\nDevolução detectada em ${new Date().toLocaleDateString('pt-BR')} (order cancelled)`;
          await prisma.bill.update({
            where: { id: existing.id },
            data: {
              status: 'cancelled',
              notes: (existing.notes || '') + refundNote,
            },
          });
          cancelledUpdated++;
        } else {
          skipped++;
        }
        continue;
      }

      // Pedido cancelado que nunca foi importado: só cria se tiver informações
      // úteis (bruto > 0). Caso contrário ignora (compras iniciadas e abandonadas).
      if (isCancelled && !order.total_amount) {
        continue;
      }

      // Extrair informações do pedido
      const itemTitle =
        order.order_items?.[0]?.item?.title || 'Venda Mercado Livre';
      const itemId = order.order_items?.[0]?.item?.id || '';
      const closedDate = new Date(order.date_closed || order.date_created);

      // Extrair taxa de venda do ML (sale_fee).
      // Campo: order.order_items[].sale_fee — vem null em pedidos recém-criados
      // e é preenchido após a liquidação. Se vier 0/null, estimamos em 18% e
      // marcamos "(est.)" nas notes. O cron backfill-salefee substitui pelo
      // valor real quando o ML liquida.
      const SALE_FEE_PCT = 0.18;
      let saleFee = 0;
      let saleFeeEstimated = false;
      if (order.order_items && order.order_items.length > 0) {
        saleFee = order.order_items.reduce(
          (sum: number, item: any) => sum + (Number(item.sale_fee) || 0),
          0
        );
      }
      if (saleFee === 0 && order.total_amount) {
        saleFee = order.total_amount * SALE_FEE_PCT;
        saleFeeEstimated = true;
      }

      // Extrair taxa de envio
      // Fórmula: list_cost - cost = taxa final que o vendedor paga
      let shippingFee = 0;
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
            const shippingDetail = await shippingResponse.json();
            const listCost = shippingDetail.shipping_option?.list_cost || 0;
            const subsidizedCost = shippingDetail.shipping_option?.cost || 0;
            // Taxa real = valor base - subsídio do ML
            shippingFee = listCost - subsidizedCost;
          }
        } catch (error) {
          console.error(`Erro ao buscar taxa de envio para pedido ${order.id}:`, error);
        }
      }

      // Calcular valor líquido (o que realmente vai receber)
      const totalTaxes = saleFee + shippingFee;
      const netAmount = order.total_amount - totalTaxes;

      // Criar única conta a receber com valor líquido
      const saleFeeSuffix = saleFeeEstimated ? ' (est.)' : '';
      const taxBreakdown = [
        saleFee > 0 ? `Taxa de venda: R$ ${saleFee.toFixed(2)}${saleFeeSuffix}` : '',
        shippingFee > 0 ? `Taxa de envio: R$ ${shippingFee.toFixed(2)}` : '',
      ]
        .filter(Boolean)
        .join(' + ');

      const packLine = order.pack_id ? `\nPack\n#${order.pack_id}\n` : '';

      const notesContent = `PEDIDO
#${order.id}
${packLine}
Comprador
${order.buyer.nickname}

Produto
${itemId}

VENDAS
Bruto: R$ ${order.total_amount.toFixed(2)} | Taxas: ${taxBreakdown} (Total: R$ ${totalTaxes.toFixed(2)}) | Líquido: R$ ${netAmount.toFixed(2)}`;

      // Quantidade total de unidades vendidas no pedido (soma de todos os itens)
      const quantity = (order.order_items || []).reduce(
        (sum, oi) => sum + (Number(oi.quantity) || 1),
        0
      ) || 1;

      // Custo total do pedido = Σ (custo_unitário × quantity) por item.
      // Se nenhum item tiver custo cadastrado, mantém null.
      let productCost: number | null = null;
      const productId: string | null = null;

      for (const oi of order.order_items || []) {
        const oiId = oi.item?.id;
        const oiQty = Number(oi.quantity) || 1;
        if (!oiId) continue;
        const cost = await prisma.mLProductCost.findUnique({
          where: { mlListingId: oiId },
          select: { productCost: true },
        });
        if (cost?.productCost) {
          productCost = (productCost ?? 0) + cost.productCost * oiQty;
        }
      }

      // dueDate = data estimada de liberação pelo ML (paidDate + 30 dias)
      const estimatedReleaseDate = new Date(closedDate);
      estimatedReleaseDate.setDate(estimatedReleaseDate.getDate() + 30);

      const cancelledSuffix = isCancelled
        ? `\n\nDevolução detectada em ${new Date().toLocaleDateString('pt-BR')} (order cancelled no ML)`
        : '';

      const tenantId = await getDefaultTenantId();
      const saleBill = await prisma.bill.create({
        data: {
          type: 'receivable',
          category: 'venda',
          description: `Venda ML - ${itemTitle} [Produto ML: ${itemId || 'sem-id'}]`,
          amount: netAmount,
          dueDate: estimatedReleaseDate,
          paidDate: closedDate,
          status: isCancelled ? 'cancelled' : 'pending',
          mlOrderId: `order_${order.id}`,
          mlPackId: order.pack_id ? String(order.pack_id) : null,
          notes: `PRODUTO ML ID: ${itemId || 'SEM ID'}\n\n${notesContent}${cancelledSuffix}`,
          productId,
          productCost,
          quantity,
          tenantId,
        },
        include: { supplier: true },
      });

      created++;
      createdBills.push(saleBill);
    }

    return NextResponse.json({
      success: true,
      message: `${created} importados, ${cancelledUpdated} cancelados atualizados, ${skipped} já existiam`,
      stats: {
        total: orders.length,
        created,
        cancelledUpdated,
        skipped,
        janela: { from: fromIso, to: toIso, months },
      },
      bills: createdBills.slice(0, 10),
    });
  } catch (error) {
    console.error('Error syncing orders:', error);
    return NextResponse.json(
      { error: 'Failed to sync orders' },
      { status: 500 }
    );
  }
}
