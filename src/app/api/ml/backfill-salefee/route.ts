import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Re-consulta o ML para Bills de venda que ainda não têm "Taxa de venda" em
 * notes (saleFee pendente). Quando o ML já liquidou, ajusta Bill.amount e
 * reescreve a linha VENDAS das notes.
 *
 * Idempotente. Roda via Vercel cron (diário).
 * Também pode ser chamado manualmente: GET /api/ml/backfill-salefee
 *
 * Só olha bills dos últimos 90 dias pra evitar custo em API.
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
    let integration = await prisma.mLIntegration.findFirst();
    if (!integration) {
      return NextResponse.json({ erro: 'integração ML não configurada' }, { status: 400 });
    }
    integration = await refreshTokenIfNeeded(integration);
    const headers = { Authorization: `Bearer ${integration.accessToken}` };

    const since = new Date();
    since.setDate(since.getDate() - 90);

    const bills = await prisma.bill.findMany({
      where: {
        type: 'receivable',
        category: 'venda',
        mlOrderId: { not: null },
        paidDate: { gte: since },
        NOT: { notes: { contains: 'Taxa de venda' } },
      },
      select: { id: true, mlOrderId: true, amount: true, notes: true },
    });

    let updated = 0;
    let zeros = 0;
    let fails = 0;

    for (const b of bills) {
      const orderId = (b.mlOrderId || '').replace(/^order_/, '');
      if (!orderId) {
        fails++;
        continue;
      }

      try {
        const res = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, { headers });
        if (!res.ok) {
          fails++;
          continue;
        }

        const order: any = await res.json();
        const saleFee = (order.order_items || []).reduce(
          (s: number, it: any) => s + (Number(it.sale_fee) || 0),
          0
        );

        if (saleFee === 0) {
          zeros++;
          continue;
        }

        const newAmount = b.amount - saleFee;

        let newNotes = b.notes || '';
        const inner = newNotes.match(/VENDAS\n([^\n]*)/)?.[1] || '';
        const envio = parseFloat(
          inner.match(/Taxa de envio:\s*R\$\s*([\d,\.]+)/)?.[1]?.replace(',', '.') || '0'
        );
        const bruto = parseFloat(
          inner.match(/Bruto:\s*R\$\s*([\d,\.]+)/)?.[1]?.replace(',', '.') || '0'
        );
        const liquido = bruto - envio - saleFee;
        const totalTaxas = envio + saleFee;

        const newLine = `VENDAS\nBruto: R$ ${bruto.toFixed(
          2
        )} | Taxas: Taxa de venda: R$ ${saleFee.toFixed(
          2
        )} + Taxa de envio: R$ ${envio.toFixed(2)} (Total: R$ ${totalTaxas.toFixed(
          2
        )}) | Líquido: R$ ${liquido.toFixed(2)}`;

        newNotes = newNotes.replace(/VENDAS\n[^\n]*/, newLine);

        await prisma.bill.update({
          where: { id: b.id },
          data: { amount: newAmount, notes: newNotes },
        });
        updated++;
      } catch {
        fails++;
      }
    }

    return NextResponse.json({
      ok: true,
      verificadas: bills.length,
      atualizadas: updated,
      aindaSemSaleFee: zeros,
      falhas: fails,
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
