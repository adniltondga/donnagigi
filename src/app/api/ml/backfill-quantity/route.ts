import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Backfill de `quantity` (e `productCost` quando aplicável) nas Bills de venda
 * já existentes. Re-busca cada pedido no ML via `mlOrderId`, soma as quantities
 * de todos os order_items e recalcula o custo total.
 *
 * Query params:
 *   - limit=N (padrão: 500) — processa no máximo N bills por request
 *   - force=1 — ignora o filtro `quantity=1` e reprocessa todas as bills
 *   - dry=1  — não grava no banco, só retorna o que seria alterado
 */

async function refreshTokenIfNeeded() {
  const integration = await prisma.mLIntegration.findFirst();
  if (!integration) throw new Error('Mercado Livre not configured');

  if (new Date() <= integration.expiresAt) return integration;

  if (!integration.refreshToken) {
    throw new Error('Mercado Livre token expired and refresh token not available');
  }

  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Mercado Livre credentials not configured');
  }

  const tokenParams = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: integration.refreshToken,
  });

  const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    body: tokenParams.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!tokenResponse.ok) throw new Error('Failed to refresh Mercado Livre token');

  const tokenData = await tokenResponse.json();
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

  return prisma.mLIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || integration.refreshToken,
      expiresAt,
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.max(1, Math.min(2000, Number(sp.get('limit')) || 500));
    const force = sp.get('force') === '1';
    const dry = sp.get('dry') === '1';

    const integration = await refreshTokenIfNeeded();
    const accessToken = integration.accessToken;

    const bills = await prisma.bill.findMany({
      where: {
        type: 'receivable',
        category: 'venda',
        mlOrderId: { not: null },
        ...(force ? {} : { quantity: 1 }),
      },
      select: {
        id: true,
        mlOrderId: true,
        quantity: true,
        productCost: true,
      },
      orderBy: { paidDate: 'desc' },
      take: limit,
    });

    let processed = 0;
    let updated = 0;
    let failed = 0;
    let unchanged = 0;
    const samples: Array<{
      billId: string;
      mlOrderId: string;
      from: { quantity: number; productCost: number | null };
      to: { quantity: number; productCost: number | null };
    }> = [];

    for (const bill of bills) {
      processed++;
      const orderId = bill.mlOrderId!.replace(/^order_/, '');

      try {
        const resp = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) {
          failed++;
          continue;
        }
        const order = await resp.json();

        const items: Array<{ item?: { id?: string }; quantity?: number }> = order.order_items || [];
        const newQuantity = items.reduce((s, oi) => s + (Number(oi.quantity) || 1), 0) || 1;

        let newProductCost: number | null = null;
        for (const oi of items) {
          const oiId = oi.item?.id;
          const oiQty = Number(oi.quantity) || 1;
          if (!oiId) continue;
          const cost = await prisma.mLProductCost.findUnique({
            where: { mlListingId: oiId },
            select: { productCost: true },
          });
          if (cost?.productCost) {
            newProductCost = (newProductCost ?? 0) + cost.productCost * oiQty;
          }
        }

        // Só atualiza se mudou algo relevante
        const quantityChanged = newQuantity !== bill.quantity;
        // Só sobrescreve custo se a bill não tinha custo OU se o novo custo é maior
        // (evita zerar custos manuais já preenchidos).
        const shouldUpdateCost =
          newProductCost !== null &&
          (bill.productCost === null || newProductCost > (bill.productCost ?? 0));

        if (!quantityChanged && !shouldUpdateCost) {
          unchanged++;
          continue;
        }

        if (samples.length < 10) {
          samples.push({
            billId: bill.id,
            mlOrderId: bill.mlOrderId!,
            from: { quantity: bill.quantity, productCost: bill.productCost },
            to: {
              quantity: newQuantity,
              productCost: shouldUpdateCost ? newProductCost : bill.productCost,
            },
          });
        }

        if (!dry) {
          await prisma.bill.update({
            where: { id: bill.id },
            data: {
              quantity: newQuantity,
              ...(shouldUpdateCost ? { productCost: newProductCost } : {}),
            },
          });
        }
        updated++;
      } catch (err) {
        console.error(`[backfill-quantity] erro em bill ${bill.id}:`, err);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      dry,
      force,
      stats: {
        candidatas: bills.length,
        processadas: processed,
        atualizadas: updated,
        semMudanca: unchanged,
        falhas: failed,
      },
      samples,
    });
  } catch (error) {
    console.error('[backfill-quantity] erro geral:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
