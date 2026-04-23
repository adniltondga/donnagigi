import prisma from '@/lib/prisma';
import { forEachMLTenant } from '@/lib/ml';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Tarefa diária (cron) que roda para TODOS os tenants com MLIntegration:
 *  1) Flipa pending → paid quando paidDate + 30 dias já passou (heurística
 *     enquanto não integramos MP)
 *  2) Busca pedidos ML dos últimos 60 dias e, quando detecta devolução
 *     (payments[].transaction_amount_refunded > 0 ou order.status = cancelled),
 *     atualiza a Bill original para status=cancelled ou amount reduzido.
 */

export async function GET(_req: NextRequest) {
  try {
    // 1) Flip pending → paid para bills cujo prazo de 30 dias já venceu
    //    (global — independe de tenant, só olha datas)
    const now = new Date();
    const flipResult = await prisma.bill.updateMany({
      where: {
        type: 'receivable',
        category: 'venda',
        status: 'pending',
        dueDate: { lte: now },
      },
      data: { status: 'paid' },
    });

    // 2) Sync de devoluções — por tenant
    let totalCanceladas = 0;
    let totalParciais = 0;
    let totalJaProcessadas = 0;
    let totalFalhas = 0;
    let totalVerificadas = 0;

    const summary = await forEachMLTenant(async (integration, tenantId) => {
      const headers = { Authorization: `Bearer ${integration.accessToken}` };

      const since = new Date();
      since.setDate(since.getDate() - 60);

      const bills = await prisma.bill.findMany({
        where: {
          tenantId,
          type: 'receivable',
          category: 'venda',
          mlOrderId: { not: null },
          paidDate: { gte: since },
          status: { in: ['pending', 'paid'] },
        },
        select: { id: true, mlOrderId: true, amount: true, notes: true, status: true },
      });

      totalVerificadas += bills.length;

      for (const b of bills) {
        const orderId = (b.mlOrderId || '').replace(/^order_/, '');
        if (!orderId) continue;

        if (b.notes && /Devolu[çc][aã]o:/.test(b.notes)) {
          totalJaProcessadas++;
          continue;
        }

        try {
          const res = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, { headers });
          if (!res.ok) {
            totalFalhas++;
            continue;
          }

          const order: any = await res.json();
          const refunded = (order.payments || []).reduce(
            (s: number, p: any) => s + (Number(p.transaction_amount_refunded) || 0),
            0
          );
          const statusCancelled = order.status === 'cancelled';

          if (refunded <= 0 && !statusCancelled) continue;

          const refundNote = `\n\nDevolução: R$ ${refunded.toFixed(2)} em ${new Date().toLocaleDateString('pt-BR')}`;
          const newNotes = (b.notes || '') + refundNote;

          if (statusCancelled || refunded >= b.amount) {
            await prisma.bill.update({
              where: { id: b.id },
              data: { status: 'cancelled', notes: newNotes },
            });
            totalCanceladas++;
          } else {
            await prisma.bill.update({
              where: { id: b.id },
              data: { amount: b.amount - refunded, notes: newNotes },
            });
            totalParciais++;
          }
        } catch {
          totalFalhas++;
        }
      }
    });

    return NextResponse.json({
      ok: true,
      flipedToPaid: flipResult.count,
      tenants: summary,
      devolucoes: {
        verificadas: totalVerificadas,
        canceladas: totalCanceladas,
        parciais: totalParciais,
        jaProcessadas: totalJaProcessadas,
        falhas: totalFalhas,
      },
    });
  } catch (error) {
    console.error('Erro em release-and-refunds:', error);
    return NextResponse.json(
      { erro: 'falha', mensagem: error instanceof Error ? error.message : 'erro' },
      { status: 500 }
    );
  }
}
