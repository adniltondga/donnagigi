import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  corsPreflight,
  extensionErrorResponse,
  requireExtensionSession,
  withCors,
} from '@/lib/extension-auth';
import { parseSaleDescription } from '@/lib/ml-format';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * POST — busca custos em lote.
 *
 * Body: { listingIds: string[] }  ex: ['MLB4518221581', 'MLB6444194488']
 *
 * Retorna:
 *   {
 *     costs: { 'MLB...': 7.75, ... },          // custo geral por listing (MLProductCost)
 *     variantCosts: {                          // custos por variação (MLProductVariantCost)
 *       'MLB...': { '191323520158': 7.00, ... }
 *     }
 *   }
 *
 * A extensão usa ambos: exibe `costs[listing]` como custo default e,
 * se o anúncio tem variações diferentes, mostra `variantCosts[listing][variationId]`.
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
      return withCors(NextResponse.json({ costs: {}, variantCosts: {}, variations: {} }));
    }

    // Pra o modal na extensão saber quais variações existem pra cada listing,
    // olhamos em dois lugares:
    //  1. Bills já sincronizadas com mlVariationId (histórico de vendas)
    //  2. MLProductVariantCost cadastrados (pode existir antes da primeira venda)
    const [listingRows, variantRows, saleBills] = await Promise.all([
      prisma.mLProductCost.findMany({
        where: { tenantId: session.tenantId, mlListingId: { in: listingIds } },
        select: { mlListingId: true, productCost: true },
      }),
      prisma.mLProductVariantCost.findMany({
        where: { tenantId: session.tenantId, mlListingId: { in: listingIds } },
        select: {
          mlListingId: true,
          variationId: true,
          variationName: true,
          productCost: true,
        },
      }),
      prisma.bill.findMany({
        where: {
          tenantId: session.tenantId,
          type: 'receivable',
          category: 'venda',
          mlVariationId: { not: null },
          OR: listingIds.flatMap((id) => [
            { description: { contains: id } },
            { notes: { contains: id } },
          ]),
        },
        select: { description: true, notes: true, mlVariationId: true },
      }),
    ]);

    const costs: Record<string, number> = {};
    for (const r of listingRows) costs[r.mlListingId] = r.productCost;

    const variantCosts: Record<string, Record<string, number>> = {};
    for (const v of variantRows) {
      if (!variantCosts[v.mlListingId]) variantCosts[v.mlListingId] = {};
      variantCosts[v.mlListingId][v.variationId] = v.productCost;
    }

    // Mapa: listingId → { variationId → variationName }
    const variations: Record<string, Record<string, string | null>> = {};

    // (1) Começa pelos variant costs (têm nome melhor, cadastrado)
    for (const v of variantRows) {
      if (!variations[v.mlListingId]) variations[v.mlListingId] = {};
      variations[v.mlListingId][v.variationId] = v.variationName;
    }

    // (2) Adiciona variações vindas das bills
    const listingRe = /MLB\d{6,}/i;
    for (const b of saleBills) {
      if (!b.mlVariationId) continue;
      const raw =
        b.description?.match(listingRe)?.[0]?.toUpperCase() ||
        b.notes?.match(listingRe)?.[0]?.toUpperCase();
      if (!raw || !listingIds.includes(raw)) continue;
      if (!variations[raw]) variations[raw] = {};
      // Só popula nome se ainda estiver vazio
      if (!variations[raw][b.mlVariationId]) {
        const parsed = parseSaleDescription(b.description);
        variations[raw][b.mlVariationId] = parsed.variation || null;
      }
    }

    return withCors(NextResponse.json({ costs, variantCosts, variations }));
  } catch (err) {
    return extensionErrorResponse(err);
  }
}

/**
 * PUT — upsert de custo (edição inline na extensão).
 *
 * Body: {
 *   mlListingId: string,
 *   variationId?: string,       // se presente, grava em MLProductVariantCost
 *   variationName?: string,     // label humano da variação (ex: "Preto · iPhone 15 PM")
 *   productCost: number,
 *   title?: string,
 *   aplicarRetroativo?: boolean // default true
 * }
 *
 * Retroativo:
 * - Com variationId: atualiza Bills do listing COM o mlVariationId correspondente que ainda estão productCost=null
 * - Sem variationId: atualiza Bills do listing que estão productCost=null E mlVariationId=null (evita sobrescrever quando já existe variant cost específico)
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
    const variationIdRaw = body?.variationId;
    const variationId = variationIdRaw ? String(variationIdRaw).trim() : null;
    const variationName = body?.variationName ? String(body.variationName).trim().slice(0, 200) : null;
    const productCost = Number(body?.productCost);
    const title = body?.title ? String(body.title).trim().slice(0, 200) : null;
    const aplicarRetroativo = body?.aplicarRetroativo !== false;

    if (!/^MLB\d{6,}$/.test(mlListingId)) {
      return withCors(NextResponse.json({ error: 'mlListingId inválido' }, { status: 400 }));
    }
    if (!Number.isFinite(productCost) || productCost < 0) {
      return withCors(NextResponse.json({ error: 'productCost inválido' }, { status: 400 }));
    }

    let saved: unknown;
    let atualizados = 0;

    if (variationId) {
      // Upsert por (mlListingId, variationId) no MLProductVariantCost
      saved = await prisma.mLProductVariantCost.upsert({
        where: { mlListingId_variationId: { mlListingId, variationId } },
        create: {
          mlListingId,
          variationId,
          variationName,
          productCost,
          tenantId: session.tenantId,
        },
        update: {
          productCost,
          ...(variationName ? { variationName } : {}),
        },
      });

      if (aplicarRetroativo) {
        // Só bills desse listing com essa variação específica e sem custo
        const res = await prisma.bill.updateMany({
          where: {
            tenantId: session.tenantId,
            type: 'receivable',
            category: 'venda',
            productCost: null,
            mlVariationId: variationId,
            OR: [
              { description: { contains: mlListingId } },
              { notes: { contains: mlListingId } },
            ],
          },
          data: { productCost },
        });
        atualizados = res.count;
      }
    } else {
      // Upsert no MLProductCost (custo geral do listing)
      saved = await prisma.mLProductCost.upsert({
        where: { mlListingId },
        create: { mlListingId, productCost, title, tenantId: session.tenantId },
        update: { productCost, ...(title ? { title } : {}) },
      });

      if (aplicarRetroativo) {
        // Bills desse listing sem custo — mas SÓ as que não têm variação específica
        // cadastrada (evita sobrescrever custo correto de variant cost).
        // Pega os variationIds que têm custo específico pra excluir.
        const variantsWithCost = await prisma.mLProductVariantCost.findMany({
          where: { tenantId: session.tenantId, mlListingId },
          select: { variationId: true },
        });
        const variationsToSkip = variantsWithCost.map((v) => v.variationId);

        const res = await prisma.bill.updateMany({
          where: {
            tenantId: session.tenantId,
            type: 'receivable',
            category: 'venda',
            productCost: null,
            ...(variationsToSkip.length > 0
              ? { mlVariationId: { notIn: variationsToSkip } }
              : {}),
            OR: [
              { description: { contains: mlListingId } },
              { notes: { contains: mlListingId } },
            ],
          },
          data: { productCost },
        });
        atualizados = res.count;
      }
    }

    return withCors(NextResponse.json({ saved, atualizados, scope: variationId ? 'variant' : 'listing' }));
  } catch (err) {
    return extensionErrorResponse(err);
  }
}
