import prisma from '@/lib/prisma';
import { forEachMLTenant } from '@/lib/ml';
import { createNotification } from '@/lib/notifications';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Tarefa diária (cron) que roda para TODOS os tenants com MLIntegration:
 *  1) Flipa pending → paid quando paidDate + 30 dias já passou (heurística
 *     enquanto não integramos MP). Cria notificação mp_release per-tenant
 *     com o valor total liberado no dia.
 *  2) Busca pedidos ML dos últimos 60 dias e, quando detecta devolução
 *     (payments[].transaction_amount_refunded > 0 ou order.status = cancelled),
 *     atualiza a Bill original para status=cancelled ou amount reduzido.
 *     Cria notificação refund per-tenant com total devolvido.
 */

const formatBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format;

export async function GET(_req: NextRequest) {
  try {
    // 1) Flip pending → paid — por tenant pra poder gerar notificação agrupada
    const now = new Date();
    const toFlip = await prisma.bill.findMany({
      where: {
        type: 'receivable',
        category: 'venda',
        status: 'pending',
        dueDate: { lte: now },
      },
      select: { id: true, tenantId: true, amount: true },
    });

    let flipedToPaid = 0;
    if (toFlip.length > 0) {
      const byTenant = new Map<string, { ids: string[]; total: number }>();
      for (const b of toFlip) {
        const slot = byTenant.get(b.tenantId) || { ids: [], total: 0 };
        slot.ids.push(b.id);
        slot.total += b.amount;
        byTenant.set(b.tenantId, slot);
      }
      for (const [tenantId, slot] of byTenant) {
        await prisma.bill.updateMany({
          where: { id: { in: slot.ids } },
          data: { status: 'paid' },
        });
        flipedToPaid += slot.ids.length;
        await createNotification({
          tenantId,
          type: 'mp_release',
          title: `Liberação: ${formatBRL(slot.total)}`,
          body: `${slot.ids.length} venda(s) liberadas hoje`,
          link: `/admin/financeiro/mercado-pago`,
        });
      }
    }

    // 2) Sync de devoluções — por tenant, com acumulador de notificações
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

      let refundCount = 0;
      let refundTotal = 0;

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

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const order: any = await res.json();
          const refunded = (order.payments || []).reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            refundCount++;
            refundTotal += b.amount;
          } else {
            await prisma.bill.update({
              where: { id: b.id },
              data: { amount: b.amount - refunded, notes: newNotes },
            });
            totalParciais++;
            refundCount++;
            refundTotal += refunded;
          }
        } catch {
          totalFalhas++;
        }
      }

      if (refundCount > 0) {
        await createNotification({
          tenantId,
          type: 'refund',
          title: `${refundCount} devolução(ões) hoje: ${formatBRL(refundTotal)}`,
          body: 'Valores deduzidos do caixa. Verifique em vendas ML.',
          link: `/admin/relatorios/vendas-ml`,
        });
      }
    });

    return NextResponse.json({
      ok: true,
      flipedToPaid,
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
