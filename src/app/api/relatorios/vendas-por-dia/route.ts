import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Agrega vendas (bills receivable + category=venda + status=paid) por dia do
 * mês (1..31). Extrai bruto/saleFee/envio das notes para calcular valores
 * reais do ML.
 *
 * Query params opcionais:
 *   - from=YYYY-MM-DD (padrão: início do ano corrente)
 *   - to=YYYY-MM-DD   (padrão: hoje)
 */
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

    const bills = await prisma.bill.findMany({
      where: {
        type: 'receivable',
        category: 'venda',
        status: { not: 'cancelled' },
        paidDate: { gte: from, lte: to },
      },
      select: { amount: true, paidDate: true, notes: true, productCost: true, quantity: true },
    });

    type DiaAgg = {
      dia: number;
      vendas: number;
      bruto: number;
      taxaVenda: number;
      envio: number;
      totalVenda: number;
      custo: number;
      lucro: number;
    };

    const map = new Map<number, DiaAgg>();
    for (let d = 1; d <= 31; d++) {
      map.set(d, {
        dia: d,
        vendas: 0,
        bruto: 0,
        taxaVenda: 0,
        envio: 0,
        totalVenda: 0,
        custo: 0,
        lucro: 0,
      });
    }

    const parseAmount = (notes: string | null, re: RegExp) => {
      const m = notes?.match(re);
      return m ? parseFloat(m[1].replace(',', '.')) : 0;
    };

    for (const b of bills) {
      if (!b.paidDate) continue;
      const dia = b.paidDate.getDate();
      const agg = map.get(dia);
      if (!agg) continue;

      const bruto = parseAmount(b.notes, /Bruto:\s*R\$\s*([\d,\.]+)/);
      const taxaVenda = parseAmount(b.notes, /Taxa de venda:\s*R\$\s*([\d,\.]+)/);
      const envio = parseAmount(b.notes, /Taxa de envio:\s*R\$\s*([\d,\.]+)/);
      const custo = b.productCost ?? 0;

      const brutoReal = bruto > 0 ? bruto : b.amount + taxaVenda + envio;
      const totalVenda = brutoReal - taxaVenda - envio; // o que efetivamente entra do ML
      const lucro = totalVenda - custo;

      agg.vendas += b.quantity ?? 1;
      agg.bruto += brutoReal;
      agg.taxaVenda += taxaVenda;
      agg.envio += envio;
      agg.totalVenda += totalVenda;
      agg.custo += custo;
      agg.lucro += lucro;
    }

    const dias = Array.from(map.values());

    const totalVendas = dias.reduce((s, d) => s + d.vendas, 0);
    const totalBruto = dias.reduce((s, d) => s + d.bruto, 0);
    const totalTaxaVenda = dias.reduce((s, d) => s + d.taxaVenda, 0);
    const totalEnvio = dias.reduce((s, d) => s + d.envio, 0);
    const totalTotalVenda = dias.reduce((s, d) => s + d.totalVenda, 0);
    const totalCusto = dias.reduce((s, d) => s + d.custo, 0);
    const totalLucro = dias.reduce((s, d) => s + d.lucro, 0);

    const zero: DiaAgg = {
      dia: 0,
      vendas: 0,
      bruto: 0,
      taxaVenda: 0,
      envio: 0,
      totalVenda: 0,
      custo: 0,
      lucro: 0,
    };
    const melhorDia = dias.reduce((b, d) => (d.bruto > b.bruto ? d : b), zero);
    const melhorDiaLucro = dias.reduce((b, d) => (d.lucro > b.lucro ? d : b), zero);

    return NextResponse.json({
      periodo: { from: from.toISOString(), to: to.toISOString() },
      totalVendas,
      totalBruto,
      totalTaxaVenda,
      totalEnvio,
      totalTotalVenda,
      totalCusto,
      totalLucro,
      melhorDia,
      melhorDiaLucro,
      dias,
    });
  } catch (error) {
    console.error('Erro em vendas-por-dia:', error);
    return NextResponse.json(
      { erro: 'Falha ao gerar relatório', mensagem: error instanceof Error ? error.message : 'erro' },
      { status: 500 }
    );
  }
}
