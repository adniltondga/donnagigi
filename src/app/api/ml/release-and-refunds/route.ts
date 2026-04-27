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
 *     cria um BillRefund linkado à Bill original. A Bill em si fica
 *     IMUTÁVEL — os totalizadores subtraem refunds via helper centralizado.
 *     Cria notificação refund per-tenant com total devolvido.
 */

const formatBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format;

interface MLPayment {
  id: number | string
  transaction_amount_refunded?: number
}

interface MLOrderCheck {
  status?: string
  payments?: MLPayment[]
}

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
        select: {
          id: true,
          mlOrderId: true,
          amount: true,
          productCost: true,
          status: true,
          refunds: {
            select: { source: true, mlPaymentId: true, amount: true },
          },
        },
      });

      totalVerificadas += bills.length;

      let refundCount = 0;
      let refundTotal = 0;

      type BillResult =
        | { kind: 'falha' }
        | { kind: 'sem-refund' }
        | { kind: 'ja-processada' }
        | { kind: 'cancelada'; amount: number }
        | { kind: 'parcial'; refunded: number };

      const checkBill = async (b: typeof bills[number]): Promise<BillResult> => {
        const orderId = (b.mlOrderId || '').replace(/^order_/, '');
        try {
          const res = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, { headers });
          if (!res.ok) return { kind: 'falha' };

          const order = (await res.json()) as MLOrderCheck;
          const payments = order.payments || [];
          const refunded = payments.reduce(
            (s, p) => s + (Number(p.transaction_amount_refunded) || 0),
            0,
          );
          const statusCancelled = order.status === 'cancelled';

          if (refunded <= 0 && !statusCancelled) return { kind: 'sem-refund' };

          // Idempotência: refund total (cancelled) ou parcial dessa payment
          // já foi processado?
          if (statusCancelled || refunded >= b.amount) {
            const already = b.refunds.some((r) => r.source === 'ml_order_cancelled');
            if (already) return { kind: 'ja-processada' };

            // Refund total
            const totalAmount = b.amount;
            const costRefunded = b.productCost ?? null;
            await prisma.billRefund.create({
              data: {
                billId: b.id,
                tenantId,
                amount: totalAmount,
                costRefunded,
                source: 'ml_order_cancelled',
                mlOrderId: b.mlOrderId,
                mlPaymentId: null,
              },
            });
            // Mantém status="cancelled" como atalho de compat — facilita
            // filtros antigos (NOT cancelled) continuarem funcionando.
            if (b.status !== 'cancelled') {
              await prisma.bill.update({
                where: { id: b.id },
                data: { status: 'cancelled' },
              });
            }
            return { kind: 'cancelada', amount: totalAmount };
          }

          // Refund parcial — agrupa por payment com refund > 0
          // Usa o primeiro pra mlPaymentId do registro (idempotência)
          const refundedPayments = payments.filter((p) => Number(p.transaction_amount_refunded) > 0);
          if (refundedPayments.length === 0) return { kind: 'sem-refund' };

          let createdAny = false;
          for (const p of refundedPayments) {
            const pid = String(p.id);
            const already = b.refunds.some(
              (r) => r.source === 'ml_partial_refund' && r.mlPaymentId === pid,
            );
            if (already) continue;
            const partial = Number(p.transaction_amount_refunded) || 0;
            if (partial <= 0) continue;
            const ratio = b.amount > 0 ? partial / b.amount : 0;
            const costRefunded = b.productCost != null ? b.productCost * ratio : null;
            await prisma.billRefund.create({
              data: {
                billId: b.id,
                tenantId,
                amount: partial,
                costRefunded,
                source: 'ml_partial_refund',
                mlOrderId: b.mlOrderId,
                mlPaymentId: pid,
              },
            });
            createdAny = true;
          }

          if (!createdAny) return { kind: 'ja-processada' };
          return { kind: 'parcial', refunded };
        } catch {
          return { kind: 'falha' };
        }
      };

      // Processa em batches paralelos. ML aceita ~10 requests concorrentes por
      // token sem reclamar; mais que isso aumenta risco de 429.
      const BATCH_SIZE = 10;
      for (let i = 0; i < bills.length; i += BATCH_SIZE) {
        const batch = bills.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(checkBill));
        for (const r of results) {
          if (r.kind === 'falha') totalFalhas++;
          else if (r.kind === 'ja-processada') totalJaProcessadas++;
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
        const body = 'Valores deduzidos do caixa. Verifique em Devoluções.';
        const link = `/admin/financeiro/devolucoes`;
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
      { status: 500 },
    );
  }
}
