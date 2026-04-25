import prisma from '@/lib/prisma';
import { forEachMLTenant } from '@/lib/ml';
import { createNotification } from '@/lib/notifications';
import { captureError } from '@/lib/sentry';
import { sendPushToTenant } from '@/lib/push';
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
        const title = `Liberação: ${formatBRL(slot.total)}`;
        const body = `${slot.ids.length} venda(s) liberadas hoje`;
        const link = `/admin/financeiro/mercado-pago`;
        await createNotification({ tenantId, type: 'mp_release', title, body, link });
        void sendPushToTenant(tenantId, { title, body, url: link });
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

      // Pré-filtra: bills que já têm devolução nas notes não precisam de fetch ML.
      const billsToCheck = bills.filter((b) => {
        if (!b.mlOrderId) return false;
        if (b.notes && /Devolu[çc][aã]o:/.test(b.notes)) {
          totalJaProcessadas++;
          return false;
        }
        return true;
      });

      let refundCount = 0;
      let refundTotal = 0;

      type BillResult =
        | { kind: 'falha' }
        | { kind: 'sem-refund' }
        | { kind: 'cancelada'; amount: number }
        | { kind: 'parcial'; refunded: number };

      const checkBill = async (b: typeof billsToCheck[number]): Promise<BillResult> => {
        const orderId = (b.mlOrderId || '').replace(/^order_/, '');
        try {
          const res = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, { headers });
          if (!res.ok) return { kind: 'falha' };

          const order: any = await res.json();
          const refunded = (order.payments || []).reduce(
            (s: number, p: any) => s + (Number(p.transaction_amount_refunded) || 0),
            0
          );
          const statusCancelled = order.status === 'cancelled';

          if (refunded <= 0 && !statusCancelled) return { kind: 'sem-refund' };

          const refundNote = `\n\nDevolução: R$ ${refunded.toFixed(2)} em ${new Date().toLocaleDateString('pt-BR')}`;
          const newNotes = (b.notes || '') + refundNote;

          if (statusCancelled || refunded >= b.amount) {
            await prisma.bill.update({
              where: { id: b.id },
              data: { status: 'cancelled', notes: newNotes },
            });
            return { kind: 'cancelada', amount: b.amount };
          } else {
            await prisma.bill.update({
              where: { id: b.id },
              data: { amount: b.amount - refunded, notes: newNotes },
            });
            return { kind: 'parcial', refunded };
          }
        } catch {
          return { kind: 'falha' };
        }
      };

      // Processa em batches paralelos. ML aceita ~10 requests concorrentes por
      // token sem reclamar; mais que isso aumenta risco de 429.
      const BATCH_SIZE = 10;
      for (let i = 0; i < billsToCheck.length; i += BATCH_SIZE) {
        const batch = billsToCheck.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(checkBill));
        for (const r of results) {
          if (r.kind === 'falha') totalFalhas++;
          else if (r.kind === 'cancelada') {
            totalCanceladas++;
            refundCount++;
            refundTotal += r.amount;
          } else if (r.kind === 'parcial') {
            totalParciais++;
            refundCount++;
            refundTotal += r.refunded;
          }
        }
      }

      if (refundCount > 0) {
        const title = `${refundCount} devolução(ões) hoje: ${formatBRL(refundTotal)}`;
        const body = 'Valores deduzidos do caixa. Verifique em vendas ML.';
        const link = `/admin/relatorios/vendas-ml`;
        await createNotification({ tenantId, type: 'refund', title, body, link });
        void sendPushToTenant(tenantId, { title, body, url: link });
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
    captureError(error, { operation: 'release-and-refunds' });
    return NextResponse.json(
      { erro: 'falha', mensagem: error instanceof Error ? error.message : 'erro' },
      { status: 500 }
    );
  }
}
