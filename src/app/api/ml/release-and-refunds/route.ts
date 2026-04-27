import prisma from '@/lib/prisma';
import { forEachMLTenant } from '@/lib/ml';
import { createNotification } from '@/lib/notifications';
import { captureError } from '@/lib/sentry';
import { sendPushToTenant } from '@/lib/push';
import { syncRefundsForTenant } from '@/lib/refund-sync';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Tarefa diária (cron) que roda para TODOS os tenants com MLIntegration:
 *  1) Flipa pending → paid quando paidDate + 30 dias já passou (heurística
 *     enquanto não integramos MP). Cria notificação mp_release per-tenant
 *     com o valor total liberado no dia.
 *  2) Sync de devoluções via syncRefundsForTenant (lib/refund-sync.ts).
 *     Cria BillRefund pra cada devolução nova; manda notificação se houver.
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

    // 2) Sync de devoluções por tenant — usa função extraída
    const totals = {
      verificadas: 0,
      canceladas: 0,
      parciais: 0,
      jaProcessadas: 0,
      falhas: 0,
    };

    const summary = await forEachMLTenant(async (integration, tenantId) => {
      const stats = await syncRefundsForTenant({
        tenantId,
        accessToken: integration.accessToken,
      });
      totals.verificadas += stats.verificadas;
      totals.canceladas += stats.canceladas;
      totals.parciais += stats.parciais;
      totals.jaProcessadas += stats.jaProcessadas;
      totals.falhas += stats.falhas;

      const refundCount = stats.canceladas + stats.parciais;
      if (refundCount > 0) {
        const title = `${refundCount} devolução(ões) hoje: ${formatBRL(stats.totalDevolvido)}`;
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
      devolucoes: totals,
    });
  } catch (error) {
    captureError(error, { operation: 'release-and-refunds' });
    return NextResponse.json(
      { erro: 'falha', mensagem: error instanceof Error ? error.message : 'erro' },
      { status: 500 },
    );
  }
}
