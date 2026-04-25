import prisma from '@/lib/prisma';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { AuthError, authErrorResponse, requireRole } from '@/lib/auth';
import { parseSaleDescription } from '@/lib/ml-format';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Extrai o primeiro "MLB\d+" que aparecer em description ou notes.
// Cobre tanto o formato novo ("[Produto ML: MLB...]") quanto o antigo
// (notes com "Produto\nMLB..." ou "PRODUTO ML ID: MLB...").
function extractListingId(description: string, notes: string | null): string | null {
  const re = /MLB\d{6,}/i;
  return description.match(re)?.[0]?.toUpperCase() || notes?.match(re)?.[0]?.toUpperCase() || null;
}

interface VariationAgg {
  variationId: string;
  variationName: string | null;
  productCost: number | null;
  vendas: number;
  totalBruto: number;
  ultimaVenda: Date | null;
}

/**
 * GET: lista todos os mlListingId distintos que já geraram venda,
 *      com título, custo geral e variações detectadas (com seus custos).
 */
export async function GET() {
  try {
    const tenantId = await getTenantIdOrDefault();

    const bills = await prisma.bill.findMany({
      where: { tenantId, type: 'receivable', category: 'venda' },
      select: {
        description: true,
        notes: true,
        amount: true,
        paidDate: true,
        productCost: true,
        mlVariationId: true,
      },
      orderBy: { paidDate: 'desc' },
    });

    // Agrega por listingId
    const agg = new Map<
      string,
      {
        title: string;
        vendas: number;
        ultimaVenda: Date | null;
        totalBruto: number;
        billCost: number | null;
        billCostDate: Date | null;
        variationsByIdMap: Map<string, VariationAgg>;
      }
    >();

    for (const b of bills) {
      const listingId = extractListingId(b.description, b.notes);
      if (!listingId) continue;

      const current =
        agg.get(listingId) ||
        {
          title: '',
          vendas: 0,
          ultimaVenda: null as Date | null,
          totalBruto: 0,
          billCost: null as number | null,
          billCostDate: null as Date | null,
          variationsByIdMap: new Map<string, VariationAgg>(),
        };

      if (!current.title) {
        const parsed = parseSaleDescription(b.description);
        current.title = parsed.title;
      }

      current.vendas += 1;
      current.totalBruto += b.amount;
      if (b.paidDate && (!current.ultimaVenda || b.paidDate > current.ultimaVenda)) {
        current.ultimaVenda = b.paidDate;
      }
      if (
        b.productCost != null &&
        (!current.billCostDate || (b.paidDate && b.paidDate > current.billCostDate))
      ) {
        current.billCost = b.productCost;
        current.billCostDate = b.paidDate;
      }

      // Agrega variação quando tem mlVariationId (bills novas/backfilled)
      if (b.mlVariationId) {
        const vId = b.mlVariationId;
        const parsed = parseSaleDescription(b.description);
        const vName = parsed.variation || null;

        const vCurrent =
          current.variationsByIdMap.get(vId) ||
          {
            variationId: vId,
            variationName: null as string | null,
            productCost: null as number | null, // preenchido depois com MLProductVariantCost
            vendas: 0,
            totalBruto: 0,
            ultimaVenda: null as Date | null,
          };

        if (!vCurrent.variationName && vName) vCurrent.variationName = vName;
        vCurrent.vendas += 1;
        vCurrent.totalBruto += b.amount;
        if (b.paidDate && (!vCurrent.ultimaVenda || b.paidDate > vCurrent.ultimaVenda)) {
          vCurrent.ultimaVenda = b.paidDate;
        }

        current.variationsByIdMap.set(vId, vCurrent);
      }

      agg.set(listingId, current);
    }

    // Custos cadastrados (listing + variant)
    let listingCosts = await prisma.mLProductCost.findMany({ where: { tenantId } });
    let listingCostMap = new Map(listingCosts.map((c) => [c.mlListingId, c]));
    const variantCosts = await prisma.mLProductVariantCost.findMany({ where: { tenantId } });
    const variantCostMap = new Map<string, typeof variantCosts[number]>();
    for (const v of variantCosts) variantCostMap.set(`${v.mlListingId}|${v.variationId}`, v);

    // Backfill: para listings que têm custo em Bill mas não em MLProductCost,
    // cria o registro automaticamente usando o custo da venda mais recente.
    const paraBackfill: { mlListingId: string; productCost: number; title: string | null }[] = [];
    for (const [listingId, a] of agg.entries()) {
      if (!listingCostMap.has(listingId) && a.billCost != null) {
        paraBackfill.push({
          mlListingId: listingId,
          productCost: a.billCost,
          title: a.title || null,
        });
      }
    }

    if (paraBackfill.length > 0) {
      await Promise.all(
        paraBackfill.map((p) =>
          prisma.mLProductCost.upsert({
            where: { tenantId_mlListingId: { tenantId, mlListingId: p.mlListingId } },
            create: { ...p, tenantId },
            update: { productCost: p.productCost, ...(p.title ? { title: p.title } : {}) },
          })
        )
      );
      listingCosts = await prisma.mLProductCost.findMany({ where: { tenantId } });
      listingCostMap = new Map(listingCosts.map((c) => [c.mlListingId, c]));
      console.log(`[custos-ml] backfill: ${paraBackfill.length} listing(s) migrados de Bill para MLProductCost`);
    }

    // União: listings de vendas + listings cadastrados manualmente
    const allIds = new Set<string>([...agg.keys(), ...listingCostMap.keys()]);

    const items = Array.from(allIds)
      .map((id) => {
        const a = agg.get(id);
        const c = listingCostMap.get(id);

        // Junta variações detectadas em vendas com variant costs cadastrados
        const variationMap = new Map<string, VariationAgg>();
        if (a) {
          for (const [vid, va] of a.variationsByIdMap.entries()) {
            variationMap.set(vid, { ...va });
          }
        }
        // Garante que variant costs cadastrados apareçam mesmo sem venda ainda
        for (const v of variantCosts) {
          if (v.mlListingId !== id) continue;
          const existing = variationMap.get(v.variationId);
          if (existing) {
            existing.productCost = v.productCost;
            if (!existing.variationName && v.variationName) existing.variationName = v.variationName;
          } else {
            variationMap.set(v.variationId, {
              variationId: v.variationId,
              variationName: v.variationName,
              productCost: v.productCost,
              vendas: 0,
              totalBruto: 0,
              ultimaVenda: null,
            });
          }
        }
        // Popula productCost das variações que existem em MLProductVariantCost
        for (const va of variationMap.values()) {
          const key = `${id}|${va.variationId}`;
          const vc = variantCostMap.get(key);
          if (vc) va.productCost = vc.productCost;
        }

        return {
          mlListingId: id,
          title: c?.title || a?.title || '',
          vendas: a?.vendas ?? 0,
          totalBruto: a?.totalBruto ?? 0,
          ultimaVenda: a?.ultimaVenda ?? null,
          productCost: c?.productCost ?? null,
          updatedAt: c?.updatedAt ?? null,
          variations: Array.from(variationMap.values()).sort((x, y) => y.vendas - x.vendas),
        };
      })
      .sort((x, y) => y.vendas - x.vendas || x.mlListingId.localeCompare(y.mlListingId));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Erro em /api/ml/custos GET:', error);
    return NextResponse.json(
      { erro: 'Falha ao listar custos', mensagem: error instanceof Error ? error.message : 'erro' },
      { status: 500 }
    );
  }
}

/**
 * PUT: upsert de custo por mlListingId (geral) OU por variação (específico).
 *
 * Body: {
 *   mlListingId: string,
 *   variationId?: string,      // se presente → grava em MLProductVariantCost
 *   variationName?: string,
 *   productCost: number,
 *   title?: string,
 *   aplicarRetroativo?: boolean // default true
 * }
 *
 * Retroativo (mesma lógica do endpoint da extensão):
 * - Com variationId: atualiza bills desse listing com essa mlVariationId e productCost=null
 * - Sem variationId: atualiza bills desse listing com productCost=null, excluindo
 *   as que têm mlVariationId com custo próprio cadastrado
 */
export async function PUT(req: NextRequest) {
  try {
    await requireRole(['OWNER', 'ADMIN']);
    const body = await req.json();
    const mlListingId = String(body?.mlListingId || '').trim().toUpperCase();
    const variationIdRaw = body?.variationId;
    const variationId = variationIdRaw ? String(variationIdRaw).trim() : null;
    const variationName = body?.variationName ? String(body.variationName).trim().slice(0, 200) : null;
    const productCost = Number(body?.productCost);
    const title = body?.title ? String(body.title).trim().slice(0, 200) : null;
    const aplicarRetroativo = body?.aplicarRetroativo !== false;

    if (!/^MLB\d{6,}$/.test(mlListingId)) {
      return NextResponse.json({ erro: 'mlListingId obrigatório/ inválido' }, { status: 400 });
    }
    if (!Number.isFinite(productCost) || productCost < 0) {
      return NextResponse.json({ erro: 'productCost inválido' }, { status: 400 });
    }

    const tenantId = await getTenantIdOrDefault();
    let saved: unknown;
    let atualizados = 0;

    if (variationId) {
      saved = await prisma.mLProductVariantCost.upsert({
        where: { tenantId_mlListingId_variationId: { tenantId, mlListingId, variationId } },
        create: { mlListingId, variationId, variationName, productCost, tenantId },
        update: { productCost, ...(variationName ? { variationName } : {}) },
      });

      if (aplicarRetroativo) {
        const res = await prisma.bill.updateMany({
          where: {
            tenantId,
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
      saved = await prisma.mLProductCost.upsert({
        where: { tenantId_mlListingId: { tenantId, mlListingId } },
        create: { mlListingId, productCost, title, tenantId },
        update: { productCost, ...(title ? { title } : {}) },
      });

      if (aplicarRetroativo) {
        // Exclui variações que já têm custo específico cadastrado
        const variantsWithCost = await prisma.mLProductVariantCost.findMany({
          where: { tenantId, mlListingId },
          select: { variationId: true },
        });
        const variationsToSkip = variantsWithCost.map((v) => v.variationId);

        const res = await prisma.bill.updateMany({
          where: {
            tenantId,
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

    return NextResponse.json({ saved, atualizados, scope: variationId ? 'variant' : 'listing' });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Erro em /api/ml/custos PUT:', error);
    return NextResponse.json(
      { erro: 'Falha ao salvar custo', mensagem: error instanceof Error ? error.message : 'erro' },
      { status: 500 }
    );
  }
}
