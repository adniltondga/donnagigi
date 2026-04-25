import prisma from '@/lib/prisma';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { computeSaleNumbers } from '@/lib/sale-notes';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Previsão de recebimentos: considera que o ML paga ~30 dias após a venda.
 * Para cada dia (1..31) do mês selecionado, soma o "Total Venda" (bruto -
 * taxaVenda - envio) das Bills cujo paidDate + 30 dias cai naquele dia.
 *
 * Query params:
 *   - year  (padrão: ano atual)
 *   - month (padrão: mês atual, 1-12)
 *   - daysToReceive (padrão: 30)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const now = new Date();
    const year = Number(sp.get('year')) || now.getFullYear();
    const month = Number(sp.get('month')) || now.getMonth() + 1;
    const daysToReceive = Number(sp.get('daysToReceive')) || 30;

    // Janela de recebimento: primeiro ao último dia do mês selecionado
    const firstDay = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month, 0, 23, 59, 59, 999);

    // Janela de paidDate: firstDay - 30d até lastDay - 30d
    const paidFrom = new Date(firstDay);
    paidFrom.setDate(paidFrom.getDate() - daysToReceive);
    const paidTo = new Date(lastDay);
    paidTo.setDate(paidTo.getDate() - daysToReceive);

    const tenantId = await getTenantIdOrDefault();
    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        type: 'receivable',
        category: 'venda',
        status: { not: 'cancelled' },
        paidDate: { gte: paidFrom, lte: paidTo },
      },
      select: { amount: true, paidDate: true, notes: true, quantity: true },
    });

    type DiaAgg = { dia: number; vendas: number; totalVenda: number };

    const map = new Map<number, DiaAgg>();
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      map.set(d, { dia: d, vendas: 0, totalVenda: 0 });
    }

    for (const b of bills) {
      if (!b.paidDate) continue;
      const expected = new Date(b.paidDate);
      expected.setDate(expected.getDate() + daysToReceive);

      if (expected < firstDay || expected > lastDay) continue;

      const s = computeSaleNumbers(b);
      const dia = expected.getDate();
      const agg = map.get(dia);
      if (!agg) continue;
      agg.vendas += b.quantity ?? 1;
      agg.totalVenda += s.totalVenda;
    }

    const dias = Array.from(map.values());
    const total = dias.reduce((s, d) => s + d.totalVenda, 0);
    const totalVendas = dias.reduce((s, d) => s + d.vendas, 0);
    const melhorDia = dias.reduce(
      (best, d) => (d.totalVenda > best.totalVenda ? d : best),
      { dia: 0, vendas: 0, totalVenda: 0 } as DiaAgg
    );

    return NextResponse.json({
      periodo: { year, month, daysToReceive, firstDay, lastDay },
      total,
      totalVendas,
      melhorDia,
      dias,
    });
  } catch (error) {
    console.error('Erro em /api/relatorios/previsao:', error);
    return NextResponse.json(
      { erro: 'Falha ao gerar previsão', mensagem: error instanceof Error ? error.message : 'erro' },
      { status: 500 }
    );
  }
}
