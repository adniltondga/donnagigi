import prisma from '@/lib/prisma';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { normalizeVariationKey, parseSaleDescription } from '@/lib/ml-format';
import { computeSaleNumbers } from '@/lib/sale-notes';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Relatório v2: KPIs com comparativo vs período anterior, timeline diária real
 * (não agrega "dia do mês"), top produtos e resumo de devoluções.
 *
 * Query params:
 *   - from=YYYY-MM-DD (padrão: início do ano corrente)
 *   - to=YYYY-MM-DD   (padrão: hoje)
 */

type KPIs = {
  pedidos: number; // contagem de vendas (bills)
  vendas: number; // soma de unidades
  bruto: number;
  taxaVenda: number;
  envio: number;
  totalVenda: number;
  custo: number;
  lucro: number;
};

type TimelinePoint = {
  date: string; // YYYY-MM-DD
  pedidos: number; // contagem de vendas (bills)
  vendas: number; // soma de unidades
  bruto: number;
  totalVenda: number;
  lucro: number;
};

type ProdutoAgg = {
  productId: string | null;
  mlListingId: string | null;
  name: string;
  variation: string | null;
  vendas: number;
  bruto: number;
  totalVenda: number;
  custo: number;
  lucro: number;
  margem: number; // %
};

type BillRow = {
  id: string;
  amount: number;
  paidDate: Date | null;
  description: string;
  notes: string | null;
  productCost: number | null;
  productId: string | null;
  quantity: number;
  product: { id: string; name: string; mlListingId: string | null } | null;
};

const emptyKPIs = (): KPIs => ({
  pedidos: 0,
  vendas: 0,
  bruto: 0,
  taxaVenda: 0,
  envio: 0,
  totalVenda: 0,
  custo: 0,
  lucro: 0,
});

function extractMlbFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/PRODUTO ML ID:\s*(MLB?\d+)/i);
  if (!m) return null;
  const raw = m[1].toUpperCase();
  return raw.startsWith('MLB') ? raw : `MLB${raw}`;
}

function aggregateKPIs(bills: BillRow[]): KPIs {
  const k = emptyKPIs();
  for (const b of bills) {
    const s = computeSaleNumbers(b);
    k.pedidos += 1;
    k.vendas += b.quantity ?? 1;
    k.bruto += s.bruto;
    k.taxaVenda += s.taxaVenda;
    k.envio += s.envio;
    k.totalVenda += s.totalVenda;
    k.custo += s.custo;
    k.lucro += s.lucro;
  }
  return k;
}

import { dateKeyBR } from '@/lib/tz';

const dateKey = dateKeyBR;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const now = new Date();

    const fromParam = sp.get('from');
    const toParam = sp.get('to');

    const from = fromParam
      ? new Date(`${fromParam}T00:00:00`)
      : new Date(now.getFullYear(), 0, 1);
    const to = toParam
      ? new Date(`${toParam}T23:59:59.999`)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const windowMs = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - windowMs);

    const tenantId = await getTenantIdOrDefault();
    const [currentBills, prevBills, cancelledBills] = await Promise.all([
      prisma.bill.findMany({
        where: {
          tenantId,
          type: 'receivable',
          category: 'venda',
          status: { not: 'cancelled' },
          paidDate: { gte: from, lte: to },
        },
        select: {
          id: true,
          amount: true,
          paidDate: true,
          description: true,
          notes: true,
          productCost: true,
          productId: true,
          product: { select: { id: true, name: true, mlListingId: true } },
          quantity: true,
        },
      }),
      prisma.bill.findMany({
        where: {
          tenantId,
          type: 'receivable',
          category: 'venda',
          status: { not: 'cancelled' },
          paidDate: { gte: prevFrom, lte: prevTo },
        },
        select: {
          id: true,
          amount: true,
          paidDate: true,
          description: true,
          notes: true,
          productCost: true,
          productId: true,
          product: { select: { id: true, name: true, mlListingId: true } },
          quantity: true,
        },
      }),
      prisma.bill.findMany({
        where: {
          tenantId,
          type: 'receivable',
          category: 'venda',
          status: 'cancelled',
          paidDate: { gte: from, lte: to },
        },
        select: {
          id: true,
          amount: true,
          paidDate: true,
          description: true,
          notes: true,
          productCost: true,
          productId: true,
          product: { select: { id: true, name: true, mlListingId: true } },
          quantity: true,
        },
      }),
    ]);

    const kpisAtual = aggregateKPIs(currentBills);
    const kpisAnterior = aggregateKPIs(prevBills);
    const kpisCancelados = aggregateKPIs(cancelledBills);

    // Timeline diária real
    const timelineMap = new Map<string, TimelinePoint>();
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const key = dateKey(d);
      timelineMap.set(key, {
        date: key,
        pedidos: 0,
        vendas: 0,
        bruto: 0,
        totalVenda: 0,
        lucro: 0,
      });
    }

    for (const b of currentBills) {
      if (!b.paidDate) continue;
      const key = dateKey(b.paidDate);
      const point = timelineMap.get(key);
      if (!point) continue;

      const s = computeSaleNumbers(b);
      point.pedidos += 1;
      point.vendas += b.quantity ?? 1;
      point.bruto += s.bruto;
      point.totalVenda += s.totalVenda;
      point.lucro += s.lucro;
    }

    const timeline = Array.from(timelineMap.values());

    // Fallback de nome: bills sem productId mas com MLB nas notes — buscar produto no banco
    const mlbsSemNome = new Set<string>();
    for (const b of currentBills) {
      if (!b.product) {
        const mlb = extractMlbFromNotes(b.notes);
        if (mlb) mlbsSemNome.add(mlb);
      }
    }
    const produtosFallback = mlbsSemNome.size > 0
      ? await prisma.product.findMany({
          where: { tenantId, mlListingId: { in: Array.from(mlbsSemNome) } },
          select: { id: true, name: true, mlListingId: true },
        })
      : [];
    const nomePorMlb = new Map<string, { id: string; name: string }>();
    for (const p of produtosFallback) {
      if (p.mlListingId) nomePorMlb.set(p.mlListingId, { id: p.id, name: p.name });
    }

    // Top produtos — chave canônica = MLB + variação normalizada (granularidade por variação).
    // Assim "Azul · iPhone 15PM" e "iPhone 15PM · Azul" caem no mesmo grupo, e variações
    // diferentes do mesmo MLB aparecem como linhas distintas (igual /admin/top-produtos).
    const produtosMap = new Map<string, ProdutoAgg>();
    for (const b of currentBills) {
      const parsed = parseSaleDescription(b.description);
      const mlbFromNotes = extractMlbFromNotes(b.notes);
      const mlbCanonico = parsed.mlListingId ?? b.product?.mlListingId ?? mlbFromNotes;
      const fallback = mlbFromNotes ? nomePorMlb.get(mlbFromNotes) : null;

      const variation = parsed.variation;
      const normalizedVariation = normalizeVariationKey(variation);
      const baseKey = mlbCanonico ?? b.product?.id ?? 'sem-produto';
      const key = normalizedVariation ? `${baseKey}|${normalizedVariation}` : baseKey;

      const name =
        parsed.title ||
        b.product?.name ||
        fallback?.name ||
        (mlbCanonico ? `Anúncio ${mlbCanonico}` : 'Sem produto');
      const productId = b.product?.id ?? fallback?.id ?? null;
      const mlListingId = mlbCanonico ?? null;

      const s = computeSaleNumbers(b);
      const qty = b.quantity ?? 1;
      const existing = produtosMap.get(key);
      if (existing) {
        existing.vendas += qty;
        existing.bruto += s.bruto;
        existing.totalVenda += s.totalVenda;
        existing.custo += s.custo;
        existing.lucro += s.lucro;
      } else {
        produtosMap.set(key, {
          productId,
          mlListingId,
          name,
          variation,
          vendas: qty,
          bruto: s.bruto,
          totalVenda: s.totalVenda,
          custo: s.custo,
          lucro: s.lucro,
          margem: 0,
        });
      }
    }

    const produtos = Array.from(produtosMap.values()).map((p) => ({
      ...p,
      margem: p.bruto > 0 ? (p.lucro / p.bruto) * 100 : 0,
    }));

    const topPorLucro = [...produtos].sort((a, b) => b.lucro - a.lucro).slice(0, 10);
    const topPorBruto = [...produtos].sort((a, b) => b.bruto - a.bruto).slice(0, 10);

    // Derivados
    const ticketMedio = kpisAtual.vendas > 0 ? kpisAtual.bruto / kpisAtual.vendas : 0;
    const ticketMedioAnterior = kpisAnterior.vendas > 0 ? kpisAnterior.bruto / kpisAnterior.vendas : 0;
    const margemPct = kpisAtual.bruto > 0 ? (kpisAtual.lucro / kpisAtual.bruto) * 100 : 0;
    const margemPctAnterior = kpisAnterior.bruto > 0 ? (kpisAnterior.lucro / kpisAnterior.bruto) * 100 : 0;

    const totalVendasTotais = kpisAtual.vendas + kpisCancelados.vendas;
    const taxaCancelamento = totalVendasTotais > 0 ? (kpisCancelados.vendas / totalVendasTotais) * 100 : 0;

    return NextResponse.json({
      periodo: { from: from.toISOString(), to: to.toISOString() },
      periodoAnterior: { from: prevFrom.toISOString(), to: prevTo.toISOString() },
      kpisAtual,
      kpisAnterior,
      derivados: {
        ticketMedio,
        ticketMedioAnterior,
        margemPct,
        margemPctAnterior,
      },
      cancelamentos: {
        vendas: kpisCancelados.vendas,
        bruto: kpisCancelados.bruto,
        totalVenda: kpisCancelados.totalVenda,
        taxaPct: taxaCancelamento,
      },
      timeline,
      topPorLucro,
      topPorBruto,
    });
  } catch (error) {
    console.error('Erro em /api/relatorios/v2:', error);
    return NextResponse.json(
      { erro: 'Falha ao gerar relatório v2', mensagem: error instanceof Error ? error.message : 'erro' },
      { status: 500 }
    );
  }
}
