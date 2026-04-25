import prisma from '@/lib/prisma';
import { forEachMLTenant } from '@/lib/ml';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Re-consulta o ML para Bills de venda que ainda não têm "Taxa de venda" em
 * notes (saleFee pendente). Quando o ML já liquidou, ajusta Bill.amount e
 * reescreve a linha VENDAS das notes.
 *
 * Idempotente. Roda via Vercel cron (diário) para TODOS os tenants.
 * Também pode ser chamado manualmente: GET /api/ml/backfill-salefee
 *
 * Só olha bills dos últimos 90 dias pra evitar custo em API.
 */

export async function GET(_req: NextRequest) {
  try {
    let totalVerificadas = 0;
    let totalUpdated = 0;
    let totalZeros = 0;
    let totalFails = 0;

    const tenantSummary = await forEachMLTenant(async (integration, tenantId) => {
      const headers = { Authorization: `Bearer ${integration.accessToken}` };

      const since = new Date();
      since.setDate(since.getDate() - 90);

      const bills = await prisma.bill.findMany({
        where: {
          tenantId,
          type: 'receivable',
          category: 'venda',
          mlOrderId: { not: null },
          paidDate: { gte: since },
          OR: [
            { NOT: { notes: { contains: 'Taxa de venda' } } },
            { notes: { contains: '(est.)' } },
            { quantity: { gt: 1 } },
          ],
        },
        select: { id: true, mlOrderId: true, amount: true, notes: true },
      });

      totalVerificadas += bills.length;

      type BillResult = { kind: 'falha' } | { kind: 'zero' } | { kind: 'updated' };

      const processBill = async (b: typeof bills[number]): Promise<BillResult> => {
        const orderId = (b.mlOrderId || '').replace(/^order_/, '');
        if (!orderId) return { kind: 'falha' };

        try {
          const res = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, { headers });
          if (!res.ok) return { kind: 'falha' };

          const order: any = await res.json();
          const realSaleFee = (order.order_items || []).reduce(
            (s: number, it: any) => s + (Number(it.sale_fee) || 0) * (Number(it.quantity) || 1),
            0
          );

          const inner = (b.notes || '').match(/VENDAS\n([^\n]*)/)?.[1] || '';
          const prevSaleFeeMatch = inner.match(/Taxa de venda:\s*R\$\s*([\d,\.]+)/);
          const prevSaleFee = prevSaleFeeMatch
            ? parseFloat(prevSaleFeeMatch[1].replace(',', '.'))
            : 0;

          const envio = parseFloat(
            inner.match(/Taxa de envio:\s*R\$\s*([\d,\.]+)/)?.[1]?.replace(',', '.') || '0'
          );
          const bruto = parseFloat(
            inner.match(/Bruto:\s*R\$\s*([\d,\.]+)/)?.[1]?.replace(',', '.') || '0'
          );

          let newSaleFee: number;
          let estimated: boolean;
          if (realSaleFee > 0) {
            newSaleFee = realSaleFee;
            estimated = false;
          } else if (!prevSaleFeeMatch && bruto > 0) {
            newSaleFee = bruto * 0.18;
            estimated = true;
          } else {
            return { kind: 'zero' };
          }

          const newAmount = b.amount + prevSaleFee - newSaleFee;
          const liquido = bruto - envio - newSaleFee;
          const totalTaxas = envio + newSaleFee;
          const suffix = estimated ? ' (est.)' : '';

          const taxasStr =
            envio > 0
              ? `Taxa de venda: R$ ${newSaleFee.toFixed(2)}${suffix} + Taxa de envio: R$ ${envio.toFixed(2)}`
              : `Taxa de venda: R$ ${newSaleFee.toFixed(2)}${suffix}`;

          const newLine = `VENDAS\nBruto: R$ ${bruto.toFixed(
            2
          )} | Taxas: ${taxasStr} (Total: R$ ${totalTaxas.toFixed(
            2
          )}) | Líquido: R$ ${liquido.toFixed(2)}`;

          const newNotes = (b.notes || '').replace(/VENDAS\n[^\n]*/, newLine);

          await prisma.bill.update({
            where: { id: b.id },
            data: { amount: newAmount, notes: newNotes },
          });
          return { kind: 'updated' };
        } catch {
          return { kind: 'falha' };
        }
      };

      // Processa em batches paralelos. ML aceita ~10 concorrentes por token.
      const BATCH_SIZE = 10;
      for (let i = 0; i < bills.length; i += BATCH_SIZE) {
        const batch = bills.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(processBill));
        for (const r of results) {
          if (r.kind === 'falha') totalFails++;
          else if (r.kind === 'zero') totalZeros++;
          else if (r.kind === 'updated') totalUpdated++;
        }
      }
    });

    return NextResponse.json({
      ok: true,
      tenants: tenantSummary,
      verificadas: totalVerificadas,
      atualizadas: totalUpdated,
      aindaSemSaleFee: totalZeros,
      falhas: totalFails,
      janelaDias: 90,
    });
  } catch (error) {
    console.error('Erro no backfill-salefee:', error);
    return NextResponse.json(
      { erro: 'falha no backfill', mensagem: error instanceof Error ? error.message : 'erro' },
      { status: 500 }
    );
  }
}
