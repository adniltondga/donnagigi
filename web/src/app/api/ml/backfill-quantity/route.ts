import prisma from '@/lib/prisma';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { getMLIntegrationForTenant } from '@/lib/ml';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Backfill de `quantity` (e `productCost` quando aplicável) nas Bills de venda
 * do tenant. Re-busca cada pedido no ML via `mlOrderId`, soma as quantities
 * de todos os order_items e recalcula o custo total.
 *
 * Query params:
 *   - limit=N (padrão: 500) — processa no máximo N bills por request
 *   - force=1 — ignora o filtro `quantity=1` e reprocessa todas as bills
 *   - dry=1  — não grava no banco, só retorna o que seria alterado
 */

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.max(1, Math.min(2000, Number(sp.get('limit')) || 500));
    const force = sp.get('force') === '1';
    const dry = sp.get('dry') === '1';

    const tenantId = await getTenantIdOrDefault();
    const integration = await getMLIntegrationForTenant(tenantId);
    if (!integration) {
      return NextResponse.json(
        { error: 'Mercado Livre not configured for this tenant' },
        { status: 400 }
      );
    }
    const accessToken = integration.accessToken;

    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
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
