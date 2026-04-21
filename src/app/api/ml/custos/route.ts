import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET: lista todos os mlListingId distintos que já geraram venda,
 *      com título (do último Bill) e custo atualmente cadastrado.
 */
export async function GET() {
  try {
    const bills = await prisma.bill.findMany({
      where: { type: 'receivable', category: 'venda' },
      select: { description: true, notes: true, amount: true, paidDate: true },
      orderBy: { paidDate: 'desc' },
    });

    // Extrair mlListingId de cada Bill (guardado no "description" como
    // "Venda ML - <título> [Produto ML: MLB...]" e também em notes)
    const agg = new Map<
      string,
      { title: string; vendas: number; ultimaVenda: Date | null; totalBruto: number }
    >();

    for (const b of bills) {
      const match = /\[Produto ML:\s*([^\]]+)\]/.exec(b.description);
      const listingId = match?.[1]?.trim();
      if (!listingId || listingId === 'sem-id') continue;

      const current = agg.get(listingId) || {
        title: '',
        vendas: 0,
        ultimaVenda: null as Date | null,
        totalBruto: 0,
      };

      if (!current.title) {
        const tMatch = /Venda ML - (.+?)\s*\[Produto ML:/.exec(b.description);
        current.title = tMatch?.[1]?.trim() || '';
      }

      current.vendas += 1;
      current.totalBruto += b.amount;
      if (b.paidDate && (!current.ultimaVenda || b.paidDate > current.ultimaVenda)) {
        current.ultimaVenda = b.paidDate;
      }

      agg.set(listingId, current);
    }

    // Todos os custos cadastrados (inclusive sem venda ainda)
    const custos = await prisma.mLProductCost.findMany();
    const custoMap = new Map(custos.map((c) => [c.mlListingId, c]));

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

    const saved = await prisma.mLProductCost.upsert({
      where: { mlListingId },
      create: { mlListingId, productCost, title },
      update: { productCost, ...(title ? { title } : {}) },
    });

    let atualizados = 0;
    if (aplicarRetroativo) {
      const res = await prisma.bill.updateMany({
        where: {
          type: 'receivable',
          category: 'venda',
          description: { contains: `[Produto ML: ${mlListingId}]` },
          productCost: null,
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
