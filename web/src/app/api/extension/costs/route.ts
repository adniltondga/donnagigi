import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  corsPreflight,
  extensionErrorResponse,
  requireExtensionSession,
  withCors,
} from '@/lib/extension-auth';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * POST — busca custos em lote.
 * Body: { listingIds: string[] }  ex: ['MLB4518221581', 'MLB6444194488']
 * Retorna: { costs: { 'MLB...': 7.75, ... } }  (apenas os que existem)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireExtensionSession(req);
    const body = await req.json().catch(() => ({}));
    const raw = Array.isArray(body?.listingIds) ? body.listingIds : [];

    const listingIds = Array.from(
      new Set(
        raw
          .map((x: unknown) => String(x || '').toUpperCase().trim())
          .filter((x: string) => /^MLB\d{6,}$/.test(x))
      )
    ) as string[];

    if (listingIds.length === 0) {
      return withCors(NextResponse.json({ costs: {} }));
    }

    const rows = await prisma.mLProductCost.findMany({
      where: { tenantId: session.tenantId, mlListingId: { in: listingIds } },
      select: { mlListingId: true, productCost: true },
    });

    const costs: Record<string, number> = {};
    for (const r of rows) costs[r.mlListingId] = r.productCost;

    return withCors(NextResponse.json({ costs }));
  } catch (err) {
    return extensionErrorResponse(err);
  }
}

/**
 * PUT — upsert de custo (edição inline na extensão).
 * Body: { mlListingId: string, productCost: number, title?: string, aplicarRetroativo?: boolean }
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await requireExtensionSession(req);
    if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
      return withCors(
        NextResponse.json({ error: 'Sem permissão pra editar custos' }, { status: 403 })
      );
    }

    const body = await req.json().catch(() => ({}));
    const mlListingId = String(body?.mlListingId || '').toUpperCase().trim();
    const productCost = Number(body?.productCost);
    const title = body?.title ? String(body.title) : null;
    const aplicarRetroativo = body?.aplicarRetroativo !== false;

    if (!/^MLB\d{6,}$/.test(mlListingId)) {
      return withCors(NextResponse.json({ error: 'mlListingId inválido' }, { status: 400 }));
    }
    if (!Number.isFinite(productCost) || productCost < 0) {
      return withCors(NextResponse.json({ error: 'productCost inválido' }, { status: 400 }));
    }

    const saved = await prisma.mLProductCost.upsert({
      where: { mlListingId },
      create: { mlListingId, productCost, title, tenantId: session.tenantId },
      update: { productCost, ...(title ? { title } : {}) },
    });

    let atualizados = 0;
    if (aplicarRetroativo) {
      const res = await prisma.bill.updateMany({
        where: {
          tenantId: session.tenantId,
          type: 'receivable',
          category: 'venda',
          productCost: null,
          OR: [
            { description: { contains: mlListingId } },
            { notes: { contains: mlListingId } },
          ],
        },
        data: { productCost },
      });
      atualizados = res.count;
    }

    return withCors(NextResponse.json({ saved, atualizados }));
  } catch (err) {
    return extensionErrorResponse(err);
  }
}
