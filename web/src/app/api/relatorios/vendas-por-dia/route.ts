import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Agrega vendas (bills receivable + category=venda + paidDate) por dia do mês (1..31).
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

    const rows = await prisma.$queryRaw<
      { day: number; count: bigint; total: number; custo: number; liquido: number }[]
    >`
      SELECT
        EXTRACT(DAY FROM "paidDate")::int AS day,
        COUNT(*)::bigint AS count,
        COALESCE(SUM(amount), 0)::float AS total,
        COALESCE(SUM(COALESCE("productCost", 0)), 0)::float AS custo,
        COALESCE(SUM(amount - COALESCE("productCost", 0)), 0)::float AS liquido
      FROM "Bill"
      WHERE type = 'receivable'
        AND category = 'venda'
        AND status = 'paid'
        AND "paidDate" IS NOT NULL
        AND "paidDate" >= ${from}
        AND "paidDate" <= ${to}
      GROUP BY day
      ORDER BY day
    `;

    // Preencher 1..31 com zeros
    const map = new Map<number, { count: number; total: number; custo: number; liquido: number }>();
    for (const r of rows) {
      map.set(r.day, {
        count: Number(r.count),
        total: Number(r.total),
        custo: Number(r.custo),
        liquido: Number(r.liquido),
      });
    }

    const dias = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1;
      const v = map.get(day) || { count: 0, total: 0, custo: 0, liquido: 0 };
      return { dia: day, vendas: v.count, total: v.total, custo: v.custo, liquido: v.liquido };
    });

    const totalGeral = dias.reduce((s, d) => s + d.total, 0);
    const totalCusto = dias.reduce((s, d) => s + d.custo, 0);
    const totalLiquido = dias.reduce((s, d) => s + d.liquido, 0);
    const totalVendas = dias.reduce((s, d) => s + d.vendas, 0);

    const zero = { dia: 0, vendas: 0, total: 0, custo: 0, liquido: 0 };
    const melhorDia = dias.reduce((best, d) => (d.total > best.total ? d : best), zero);
    const melhorDiaLucro = dias.reduce((best, d) => (d.liquido > best.liquido ? d : best), zero);

    return NextResponse.json({
      periodo: { from: from.toISOString(), to: to.toISOString() },
      totalVendas,
      totalGeral,
      totalCusto,
      totalLiquido,
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
