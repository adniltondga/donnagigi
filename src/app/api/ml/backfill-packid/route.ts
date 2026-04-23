import prisma from '@/lib/prisma';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { getMLIntegrationForTenant } from '@/lib/ml';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Backfill de `mlPackId` nas Bills de venda do tenant. Re-consulta cada pedido
 * no ML via `mlOrderId` e grava `order.pack_id` quando existir.
 *
 * Query params:
 *   - limit=N (padrão: 500, max: 2000)
 *   - force=1 — reprocessa bills que já têm mlPackId
 *   - dry=1  — não grava
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
    const headers = { Authorization: `Bearer ${integration.accessToken}` };

    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        type: 'receivable',
        category: 'venda',
        mlOrderId: { not: null },
        ...(force ? {} : { mlPackId: null }),
      },
      select: { id: true, mlOrderId: true, mlPackId: true },
      orderBy: { paidDate: 'desc' },
      take: limit,
    });

    let processed = 0;
    let updated = 0;
    let noPack = 0;
    let failed = 0;
    const samples: Array<{ billId: string; mlOrderId: string; mlPackId: string }> = [];

    for (const bill of bills) {
      processed++;
      const orderId = bill.mlOrderId!.replace(/^order_/, '');

      try {
        const r = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, { headers });
        if (!r.ok) {
          failed++;
          continue;
        }
        const order: any = await r.json();
        const packId = order.pack_id ? String(order.pack_id) : null;

        if (!packId) {
          noPack++;
          continue;
        }

        if (samples.length < 10) {
          samples.push({ billId: bill.id, mlOrderId: bill.mlOrderId!, mlPackId: packId });
        }

        if (!dry) {
          await prisma.bill.update({
            where: { id: bill.id },
            data: { mlPackId: packId },
          });
        }
        updated++;
      } catch (err) {
        console.error(`[backfill-packid] erro em ${bill.id}:`, err);
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
        semPackId: noPack,
        falhas: failed,
      },
      samples,
    });
  } catch (error) {
    console.error('[backfill-packid] erro geral:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro' },
      { status: 500 }
    );
  }
}
