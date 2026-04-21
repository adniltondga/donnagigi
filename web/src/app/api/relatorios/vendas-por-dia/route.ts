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
      { day: number; count: bigint; total: number }[]
    >`
      SELECT
        EXTRACT(DAY FROM "paidDate")::int AS day,
        COUNT(*)::bigint AS count,
        COALESCE(SUM(amount), 0)::float AS total
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
    const map = new Map<number, { count: number; total: number }>();
    for (const r of rows) {
      map.set(r.day, { count: Number(r.count), total: Number(r.total) });
    }

    const dias = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1;
      const v = map.get(day) || { count: 0, total: 0 };
      return { dia: day, vendas: v.count, total: v.total };
    });

    const totalGeral = dias.reduce((s, d) => s + d.total, 0);
    const totalVendas = dias.reduce((s, d) => s + d.vendas, 0);

    const melhorDia = dias.reduce(
      (best, d) => (d.total > best.total ? d : best),
      { dia: 0, vendas: 0, total: 0 }
    );

    return NextResponse.json({
      periodo: { from: from.toISOString(), to: to.toISOString() },
      totalVendas,
      totalGeral,
      melhorDia,
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
