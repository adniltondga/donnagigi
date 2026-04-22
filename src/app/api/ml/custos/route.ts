import prisma from '@/lib/prisma';
import { getDefaultTenantId } from '@/lib/tenant';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Extrai o primeiro "MLB\d+" que aparecer em description ou notes.
// Cobre tanto o formato novo ("[Produto ML: MLB...]") quanto o antigo
// (notes com "Produto\nMLB..." ou "PRODUTO ML ID: MLB...").
function extractListingId(description: string, notes: string | null): string | null {
  const re = /MLB\d{6,}/i;
  return description.match(re)?.[0]?.toUpperCase() || notes?.match(re)?.[0]?.toUpperCase() || null;
}

/**
 * GET: lista todos os mlListingId distintos que já geraram venda,
 *      com título (do último Bill) e custo atualmente cadastrado.
 */
export async function GET() {
  try {
    const bills = await prisma.bill.findMany({
      where: { type: 'receivable', category: 'venda' },
      select: { description: true, notes: true, amount: true, paidDate: true, productCost: true },
      orderBy: { paidDate: 'desc' },
    });

    // Extrair mlListingId de cada Bill (guardado no "description" como
    // "Venda ML - <título> [Produto ML: MLB...]" e também em notes)
    const agg = new Map<
      string,
      {
        title: string;
        vendas: number;
        ultimaVenda: Date | null;
        totalBruto: number;
        // custo mais recente encontrado em Bill.productCost (usado pra backfill)
        billCost: number | null;
        billCostDate: Date | null;
      }
    >();

    for (const b of bills) {
      const listingId = extractListingId(b.description, b.notes);
      if (!listingId) continue;

      const current = agg.get(listingId) || {
        title: '',
        vendas: 0,
        ultimaVenda: null as Date | null,
        totalBruto: 0,
        billCost: null as number | null,
        billCostDate: null as Date | null,
      };

      if (!current.title) {
        // Formato novo: "Venda ML - <título> [Produto ML: MLB...]"
        // Formato antigo: "Venda ML - <título>"
        const tMatchNew = /Venda ML - (.+?)\s*\[Produto ML:/.exec(b.description);
        const tMatchOld = /Venda ML - (.+)$/.exec(b.description);
        current.title = (tMatchNew?.[1] || tMatchOld?.[1] || '').trim();
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

      agg.set(listingId, current);
    }

    // Todos os custos cadastrados (inclusive sem venda ainda)
    let custos = await prisma.mLProductCost.findMany();
    let custoMap = new Map(custos.map((c) => [c.mlListingId, c]));

    // Backfill: para listings que têm custo em Bill mas não em MLProductCost,
    // cria o registro automaticamente usando o custo da venda mais recente.
    const paraBackfill: { mlListingId: string; productCost: number; title: string | null }[] = [];
    for (const [listingId, a] of agg.entries()) {
      if (!custoMap.has(listingId) && a.billCost != null) {
        paraBackfill.push({
          mlListingId: listingId,
          productCost: a.billCost,
          title: a.title || null,
        });
      }
    }

    if (paraBackfill.length > 0) {
      const backfillTenantId = await getDefaultTenantId();
      await Promise.all(
        paraBackfill.map((p) =>
          prisma.mLProductCost.upsert({
            where: { mlListingId: p.mlListingId },
            create: { ...p, tenantId: backfillTenantId },
            update: { productCost: p.productCost, ...(p.title ? { title: p.title } : {}) },
          })
        )
      );
      // Recarregar custos após backfill
      custos = await prisma.mLProductCost.findMany();
      custoMap = new Map(custos.map((c) => [c.mlListingId, c]));
      console.log(`[custos-ml] backfill: ${paraBackfill.length} listing(s) migrados de Bill para MLProductCost`);
    }

    // União: listings de vendas + listings cadastrados manualmente
    const allIds = new Set<string>([...agg.keys(), ...custoMap.keys()]);

    const items = Array.from(allIds)
      .map((id) => {
        const a = agg.get(id);
        const c = custoMap.get(id);
        return {
          mlListingId: id,
          title: c?.title || a?.title || '',
          vendas: a?.vendas ?? 0,
          totalBruto: a?.totalBruto ?? 0,
          ultimaVenda: a?.ultimaVenda ?? null,
          productCost: c?.productCost ?? null,
          updatedAt: c?.updatedAt ?? null,
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
 * PUT: upsert de custo por mlListingId.
 * Body: { mlListingId: string, productCost: number, title?: string, aplicarRetroativo?: boolean }
 *
 * Se aplicarRetroativo=true, atualiza também todas as Bills de venda daquele
 * listing que estão com productCost=null.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const mlListingId = String(body?.mlListingId || '').trim();
    const productCost = Number(body?.productCost);
    const title = body?.title ? String(body.title) : null;
    const aplicarRetroativo = body?.aplicarRetroativo !== false;

    if (!mlListingId) {
      return NextResponse.json({ erro: 'mlListingId obrigatório' }, { status: 400 });
    }
    if (!Number.isFinite(productCost) || productCost < 0) {
      return NextResponse.json({ erro: 'productCost inválido' }, { status: 400 });
    }

    const tenantId = await getDefaultTenantId();
    const saved = await prisma.mLProductCost.upsert({
      where: { mlListingId },
      create: { mlListingId, productCost, title, tenantId },
      update: { productCost, ...(title ? { title } : {}) },
    });

    let atualizados = 0;
    if (aplicarRetroativo) {
      // Casa tanto description (formato novo ou antigo) quanto notes
      const res = await prisma.bill.updateMany({
        where: {
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

    return NextResponse.json({ saved, atualizados });
  } catch (error) {
    console.error('Erro em /api/ml/custos PUT:', error);
    return NextResponse.json(
      { erro: 'Falha ao salvar custo', mensagem: error instanceof Error ? error.message : 'erro' },
      { status: 500 }
    );
  }
}
