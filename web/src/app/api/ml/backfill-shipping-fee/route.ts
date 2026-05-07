import prisma from '@/lib/prisma';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { getMLIntegrationForTenant } from '@/lib/ml';
import { parseSaleNotes } from '@/lib/sale-notes';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Recalcula a taxa de envio de bills ML usando a fórmula correta:
 *   seller_fee = max(0, list_cost - buyer_cost - ml_compensation)
 *
 * Útil após o fix do commit afa9aae que usava `cost` diretamente (errado
 * para pedidos onde o vendedor absorve o frete grátis do comprador).
 *
 * Pack-aware: bills não-âncora (não têm a menor mlOrderId do pack) são
 * ignoradas — frete delas deve permanecer 0 para não duplicar o custo.
 *
 * Query params:
 *   dry=1             — modo leitura, sem gravar
 *   since=YYYY-MM-DD  — data inicial de paidDate (default: ontem)
 *   until=YYYY-MM-DD  — data final inclusiva (default: hoje)
 */

function rewriteVendasLine(
  notes: string,
  bruto: number,
  taxaVenda: number,
  saleFeeEstimated: boolean,
  envio: number,
): string {
  const totalTaxas = taxaVenda + envio;
  const liquido = bruto - totalTaxas;
  const taxBreakdown = [
    taxaVenda > 0
      ? `Taxa de venda: R$ ${taxaVenda.toFixed(2)}${saleFeeEstimated ? ' (est.)' : ''}`
      : '',
    envio > 0 ? `Taxa de envio: R$ ${envio.toFixed(2)}` : '',
  ]
    .filter(Boolean)
    .join(' + ');
  const newLine = taxBreakdown
    ? `Bruto: R$ ${bruto.toFixed(2)} | Taxas: ${taxBreakdown} (Total: R$ ${totalTaxas.toFixed(2)}) | Líquido: R$ ${liquido.toFixed(2)}`
    : `Bruto: R$ ${bruto.toFixed(2)} | Líquido: R$ ${liquido.toFixed(2)}`;
  return notes.replace(/Bruto:\s*R\$[^\n]+/, newLine);
}

interface BillResult {
  mlOrderId: string;
  envioAntes: number;
  envioDepois: number;
  amountAntes: number;
  amountDepois: number;
  status: 'updated' | 'unchanged' | 'no-shipping' | 'non-anchor' | 'falha';
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const dry = sp.get('dry') === '1';

    const tenantId = await getTenantIdOrDefault();
    const integration = await getMLIntegrationForTenant(tenantId);
    if (!integration?.accessToken) {
      return NextResponse.json({ error: 'ML não configurado' }, { status: 400 });
    }
    const { accessToken } = integration;
    const headers = { Authorization: `Bearer ${accessToken}` };

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    })();
    const sinceStr = sp.get('since') ?? yesterdayStr;
    const untilStr = sp.get('until') ?? todayStr;

    const since = new Date(`${sinceStr}T00:00:00-03:00`);
    const until = new Date(`${untilStr}T23:59:59-03:00`);

    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        type: 'receivable',
        category: 'venda',
        mlOrderId: { not: null },
        paidDate: { gte: since, lte: until },
        status: { not: 'cancelled' },
      },
      select: { id: true, mlOrderId: true, mlPackId: true, amount: true, notes: true },
    });

    // Monta mapa packId → menor mlOrderId numérico (= âncora do pack)
    const packAnchorMap = new Map<string, number>();
    for (const b of bills) {
      if (!b.mlPackId) continue;
      const num = Number((b.mlOrderId ?? '').replace(/^order_/, '')) || 0;
      const current = packAnchorMap.get(b.mlPackId);
      if (current === undefined || num < current) {
        packAnchorMap.set(b.mlPackId, num);
      }
    }

    const results: BillResult[] = [];

    const BATCH = 5;
    for (let i = 0; i < bills.length; i += BATCH) {
      const batch = bills.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (bill) => {
          const orderId = (bill.mlOrderId ?? '').replace(/^order_/, '');
          const parsed = parseSaleNotes(bill.notes);

          // Bills de pack não-âncora devem ficar com envio=0
          if (bill.mlPackId) {
            const anchorNum = packAnchorMap.get(bill.mlPackId);
            const myNum = Number(orderId) || 0;
            if (anchorNum !== myNum) {
              results.push({
                mlOrderId: bill.mlOrderId ?? '',
                envioAntes: parsed.envio,
                envioDepois: 0,
                amountAntes: bill.amount,
                amountDepois: bill.amount,
                status: 'non-anchor',
              });
              return;
            }
          }

          try {
            const orderRes = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
              headers,
            });
            if (!orderRes.ok) {
              results.push({
                mlOrderId: bill.mlOrderId ?? '',
                envioAntes: parsed.envio,
                envioDepois: parsed.envio,
                amountAntes: bill.amount,
                amountDepois: bill.amount,
                status: 'falha',
              });
              return;
            }
            const order = (await orderRes.json()) as { shipping?: { id?: string } };
            const shippingId = order.shipping?.id;

            if (!shippingId) {
              results.push({
                mlOrderId: bill.mlOrderId ?? '',
                envioAntes: parsed.envio,
                envioDepois: 0,
                amountAntes: bill.amount,
                amountDepois: bill.amount,
                status: 'no-shipping',
              });
              return;
            }

            const shipRes = await fetch(`https://api.mercadolibre.com/shipments/${shippingId}`, {
              headers,
            });
            if (!shipRes.ok) {
              results.push({
                mlOrderId: bill.mlOrderId ?? '',
                envioAntes: parsed.envio,
                envioDepois: parsed.envio,
                amountAntes: bill.amount,
                amountDepois: bill.amount,
                status: 'falha',
              });
              return;
            }
            const detail = (await shipRes.json()) as {
              base_cost?: number;
              shipping_option?: { list_cost?: number; cost?: number };
              cost_components?: { compensation?: number };
            };

            const listCost = detail.shipping_option?.list_cost ?? 0;
            const cost = detail.shipping_option?.cost ?? 0;
            const compensation = detail.cost_components?.compensation ?? 0;
            const novoEnvio = Math.max(0, listCost - cost - compensation);

            const diff = Math.abs(novoEnvio - parsed.envio);
            if (diff < 0.01) {
              results.push({
                mlOrderId: bill.mlOrderId ?? '',
                envioAntes: parsed.envio,
                envioDepois: novoEnvio,
                amountAntes: bill.amount,
                amountDepois: bill.amount,
                status: 'unchanged',
              });
              return;
            }

            const bruto =
              parsed.bruto > 0
                ? parsed.bruto
                : bill.amount + parsed.taxaVenda + parsed.envio;
            const novoAmount = bruto - parsed.taxaVenda - novoEnvio;
            const novoNotes = bill.notes
              ? rewriteVendasLine(
                  bill.notes,
                  bruto,
                  parsed.taxaVenda,
                  parsed.saleFeeEstimated,
                  novoEnvio,
                )
              : bill.notes;

            if (!dry) {
              await prisma.bill.update({
                where: { id: bill.id },
                data: { amount: novoAmount, notes: novoNotes },
              });
            }

            results.push({
              mlOrderId: bill.mlOrderId ?? '',
              envioAntes: parsed.envio,
              envioDepois: novoEnvio,
              amountAntes: bill.amount,
              amountDepois: novoAmount,
              status: 'updated',
            });
          } catch {
            results.push({
              mlOrderId: bill.mlOrderId ?? '',
              envioAntes: parsed.envio,
              envioDepois: parsed.envio,
              amountAntes: bill.amount,
              amountDepois: bill.amount,
              status: 'falha',
            });
          }
        }),
      );
    }

    const updated = results.filter((r) => r.status === 'updated');
    const falhas = results.filter((r) => r.status === 'falha');

    return NextResponse.json({
      dry,
      periodo: { since: sinceStr, until: untilStr },
      totais: {
        verificadas: results.length,
        atualizadas: updated.length,
        semMudanca: results.filter((r) => r.status === 'unchanged').length,
        nonAnchor: results.filter((r) => r.status === 'non-anchor').length,
        semFrete: results.filter((r) => r.status === 'no-shipping').length,
        falhas: falhas.length,
      },
      atualizadas: updated,
      falhas: falhas.map((r) => r.mlOrderId),
    });
  } catch (err) {
    console.error('[backfill-shipping-fee]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
