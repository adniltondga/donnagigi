import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Tarefa diária que:
 *  1) Flipa pending → paid quando paidDate + 30 dias já passou (heurística
 *     enquanto não integramos MP)
 *  2) Busca pedidos ML dos últimos 60 dias e, quando detecta devolução
 *     (payments[].transaction_amount_refunded > 0 ou order.status = cancelled),
 *     atualiza a Bill original para status=cancelled ou amount reduzido.
 */

async function refreshTokenIfNeeded(integration: any) {
  if (new Date() <= integration.expiresAt) return integration;
  if (!integration.refreshToken) throw new Error('sem refresh token');

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ML_CLIENT_ID!,
    client_secret: process.env.ML_CLIENT_SECRET!,
    refresh_token: integration.refreshToken,
  });

  const r = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    body: params.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!r.ok) throw new Error('falha ao renovar token ML');

  const d = await r.json();
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + d.expires_in);
  return prisma.mLIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: d.access_token,
      refreshToken: d.refresh_token || integration.refreshToken,
      expiresAt,
    },
  });
}

export async function GET(_req: NextRequest) {
  try {
    // 1) Flip pending → paid para bills cujo prazo de 30 dias já venceu
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

    // 2) Sync de devoluções dos últimos 60 dias
    let integration = await prisma.mLIntegration.findFirst();
    if (!integration) {
      return NextResponse.json({
        flipedToPaid: flipResult.count,
        erroDevolucoes: 'integração ML não configurada',
      });
    }
    integration = await refreshTokenIfNeeded(integration);
    const headers = { Authorization: `Bearer ${integration.accessToken}` };

    const since = new Date();
    since.setDate(since.getDate() - 60);

    const bills = await prisma.bill.findMany({
      where: {
        type: 'receivable',
        category: 'venda',
        mlOrderId: { not: null },
        paidDate: { gte: since },
        status: { in: ['pending', 'paid'] },
      },
      select: { id: true, mlOrderId: true, amount: true, notes: true, status: true },
    });

    let canceladas = 0;
    let parciais = 0;
    let jaProcessadas = 0;
    let falhas = 0;

    for (const b of bills) {
      const orderId = (b.mlOrderId || '').replace(/^order_/, '');
      if (!orderId) continue;

      // Se já foi marcada com devolução, pula
      if (b.notes && /Devolu[çc][aã]o:/.test(b.notes)) {
        jaProcessadas++;
        continue;
      }

      try {
        const res = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, { headers });
        if (!res.ok) {
          falhas++;
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
          // Total: cancela a bill
          await prisma.bill.update({
            where: { id: b.id },
            data: { status: 'cancelled', notes: newNotes },
          });
          canceladas++;
        } else {
          // Parcial: reduz amount
          await prisma.bill.update({
            where: { id: b.id },
            data: { amount: b.amount - refunded, notes: newNotes },
          });
          parciais++;
        }
      } catch {
        falhas++;
      }
    }

    return NextResponse.json({
      ok: true,
      flipedToPaid: flipResult.count,
      devolucoes: {
        verificadas: bills.length,
        canceladas,
        parciais,
        jaProcessadas,
        falhas,
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
