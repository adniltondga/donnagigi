import prisma from '@/lib/prisma';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { parseSaleNotes } from '@/lib/sale-notes';
import { normalizePackShipping } from '@/lib/ml-pack-shipping';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Backfill de frete por pack ML — varre todos os packs do tenant e chama
 * `normalizePackShipping` em cada um. Lógica detalhada vive em
 * `lib/ml-pack-shipping.ts`; aqui é só orquestração + relatório.
 *
 * Query params:
 *   - dry=1   — não grava, só relata o impacto
 *   - limit=N — máximo de packs processados (default 500, max 2000)
 */

interface SampleEntry {
  mlPackId: string;
  anchor: {
    mlOrderId: string;
    envioAntes: number;
    envioDepois: number;
  };
  others: Array<{
    mlOrderId: string;
    envioAntes: number;
    envioDepois: number;
  }>;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const dry = sp.get('dry') === '1';
    const limit = Math.max(1, Math.min(2000, Number(sp.get('limit')) || 500));
    const tenantId = await getTenantIdOrDefault();

    const packGroups = await prisma.bill.groupBy({
      by: ['mlPackId'],
      where: {
        tenantId,
        type: 'receivable',
        category: 'venda',
        mlPackId: { not: null },
        status: { not: 'cancelled' },
      },
      _count: { _all: true },
    });

    const multiPacks = packGroups
      .filter((g) => g._count._all > 1 && g.mlPackId)
      .slice(0, limit);

    const stats = {
      packsExaminados: multiPacks.length,
      packsCorrigidos: 0,
      billsZeradas: 0,
      billsAnchorAjustadas: 0,
      enviosFantasmaRemovidos: 0,
    };
    const samples: SampleEntry[] = [];

    for (const pack of multiPacks) {
      const mlPackId = pack.mlPackId!;

      const beforeBills = await prisma.bill.findMany({
        where: {
          tenantId,
          type: 'receivable',
          category: 'venda',
          mlPackId,
          status: { not: 'cancelled' },
        },
        select: { id: true, mlOrderId: true, notes: true },
      });
      const beforeMap = new Map(beforeBills.map((b) => [b.id, b]));
      const sortedBefore = [...beforeBills].sort((a, b) => {
        const an = Number((a.mlOrderId || '').replace(/^order_/, '')) || 0;
        const bn = Number((b.mlOrderId || '').replace(/^order_/, '')) || 0;
        return an - bn;
      });

      const res = await normalizePackShipping({ tenantId, mlPackId, dry });
      if (!res.touched) continue;

      stats.packsCorrigidos++;
      stats.billsZeradas += res.billsZeradas;
      stats.enviosFantasmaRemovidos += res.enviosFantasmaRemovidos;
      if (res.anchorAjustada) stats.billsAnchorAjustadas++;

      if (samples.length < 20 && sortedBefore.length > 0) {
        const anchorBefore = sortedBefore[0];
        const othersBefore = sortedBefore.slice(1);
        const anchorAfter = dry
          ? beforeMap.get(anchorBefore.id)!
          : (await prisma.bill.findUnique({
              where: { id: anchorBefore.id },
              select: { id: true, mlOrderId: true, notes: true },
            }))!;
        const othersAfter = dry
          ? othersBefore
          : await prisma.bill.findMany({
              where: { id: { in: othersBefore.map((o) => o.id) } },
              select: { id: true, mlOrderId: true, notes: true },
            });
        const othersAfterMap = new Map(othersAfter.map((o) => [o.id, o]));

        samples.push({
          mlPackId,
          anchor: {
            mlOrderId: anchorBefore.mlOrderId || '',
            envioAntes: parseSaleNotes(anchorBefore.notes).envio,
            envioDepois: parseSaleNotes(anchorAfter.notes).envio,
          },
          others: othersBefore.map((o) => {
            const after = othersAfterMap.get(o.id) || o;
            return {
              mlOrderId: o.mlOrderId || '',
              envioAntes: parseSaleNotes(o.notes).envio,
              envioDepois: parseSaleNotes(after.notes).envio,
            };
          }),
        });
      }
    }

    return NextResponse.json({ success: true, dry, stats, samples });
  } catch (err) {
    console.error('[backfill-pack-shipping] erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
