/**
 * Reprocessa todas as bills ML pagas hoje: re-busca o order do ML e o
 * payment do MP, recalcula `saleFee + envio + mpNet` com os valores
 * atuais da API, e atualiza `bill.amount` + linha VENDAS das notes se
 * algo mudou (consolidação de saleFee, estorno creditado depois do
 * sync inicial, etc).
 *
 * Pack-aware: depois de atualizar, roda `normalizePackShipping` nos
 * packs afetados pra manter o modelo âncora.
 *
 * Usage:
 *   npx tsx scripts/reprocess-today.ts dry   # dry-run (default em prod!)
 *   npx tsx scripts/reprocess-today.ts       # aplica
 */
import 'dotenv/config';
import prisma from '@/lib/prisma';
import { forEachMLTenant } from '@/lib/ml';
import { getMPIntegrationForTenant } from '@/lib/mp';
import { normalizePackShipping } from '@/lib/ml-pack-shipping';
import { parseSaleNotes } from '@/lib/sale-notes';

const isDry = process.argv.includes('dry');
const SALE_FEE_PCT = 0.18;

async function fetchMPNet(paymentId: number | string, mpToken: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const net: unknown = data?.transaction_details?.net_received_amount;
    return typeof net === 'number' && net > 0 ? net : null;
  } catch {
    return null;
  }
}

function rewriteVendasLine(
  notes: string,
  bruto: number,
  taxaVenda: number,
  saleFeeEstimated: boolean,
  envio: number,
  liquido: number,
): string {
  const totalTaxas = taxaVenda + envio;
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

async function main() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  console.log(
    `[reprocess-today] dry=${isDry} | janela ${todayStart.toISOString()} → ${tomorrowStart.toISOString()}`,
  );

  const totals = {
    bills: 0,
    atualizadas: 0,
    skipFalha: 0,
    skipSemMudanca: 0,
    packsNormalizados: 0,
  };
  const affectedPacks = new Set<string>();

  await forEachMLTenant(async (mlIntegration, tenantId) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    const tenantName = tenant?.name ?? tenantId;
    const mp = await getMPIntegrationForTenant(tenantId);

    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        type: 'receivable',
        category: 'venda',
        status: { not: 'cancelled' },
        paidDate: { gte: todayStart, lt: tomorrowStart },
        mlOrderId: { not: null },
      },
      select: {
        id: true,
        mlOrderId: true,
        mlPackId: true,
        amount: true,
        notes: true,
      },
    });

    if (bills.length === 0) {
      console.log(`${tenantName}: nenhuma bill hoje.`);
      return;
    }
    console.log(`\n>>> ${tenantName}: ${bills.length} bills paid today`);
    totals.bills += bills.length;

    for (const bill of bills) {
      const orderId = bill.mlOrderId!.replace(/^order_/, '');
      try {
        const orderRes = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${mlIntegration.accessToken}` },
        });
        if (!orderRes.ok) {
          console.log(`  ! ${bill.mlOrderId}: ML /orders → ${orderRes.status}`);
          totals.skipFalha++;
          continue;
        }
        const order = await orderRes.json();

        // saleFee atual da API ML
        let saleFee = 0;
        let saleFeeEstimated = false;
        if (Array.isArray(order.order_items)) {
          for (const oi of order.order_items) {
            saleFee += (Number(oi.sale_fee) || 0) * (Number(oi.quantity) || 1);
          }
        }
        if (saleFee === 0 && order.total_amount) {
          saleFee = order.total_amount * SALE_FEE_PCT;
          saleFeeEstimated = true;
        }

        // envio: só fetch se for âncora (ou avulsa). normalizePackShipping
        // depois zera não-âncoras. Por simplicidade aqui preservamos o
        // envio que já está nas notes pra pack (não-âncora vai pra 0 no
        // normalize); pra avulsa, re-fetch sempre.
        const parsed = parseSaleNotes(bill.notes);
        let envio = parsed.envio;
        if (!bill.mlPackId && order.shipping?.id) {
          try {
            const shipRes = await fetch(
              `https://api.mercadolibre.com/shipments/${order.shipping.id}`,
              { headers: { Authorization: `Bearer ${mlIntegration.accessToken}` } },
            );
            if (shipRes.ok) {
              const detail = await shipRes.json();
              const listCost: number = detail.shipping_option?.list_cost ?? 0;
              const cost: number = detail.shipping_option?.cost ?? 0;
              const compensation: number = detail.cost_components?.compensation ?? 0;
              envio = Math.max(0, listCost - cost - compensation);
            }
          } catch {
            // mantém envio antigo
          }
        }

        // mpNet
        let finalNet = order.total_amount - saleFee - envio;
        if (mp?.accessToken && order.payments?.[0]?.id) {
          const mpNet = await fetchMPNet(order.payments[0].id, mp.accessToken);
          if (mpNet !== null) finalNet = mpNet;
        }

        // Comparar com estado atual
        const bruto = parsed.bruto > 0 ? parsed.bruto : Number(order.total_amount) || 0;
        const taxaChanged = Math.abs(parsed.taxaVenda - saleFee) > 0.01;
        const envioChanged = Math.abs(parsed.envio - envio) > 0.01;
        const amountChanged = Math.abs(bill.amount - finalNet) > 0.01;

        if (!taxaChanged && !envioChanged && !amountChanged) {
          totals.skipSemMudanca++;
          continue;
        }

        const newNotes = bill.notes
          ? rewriteVendasLine(bill.notes, bruto, saleFee, saleFeeEstimated, envio, finalNet)
          : bill.notes;

        console.log(`  → ${bill.mlOrderId}`);
        if (taxaChanged)
          console.log(`     taxa  ${parsed.taxaVenda.toFixed(2)} → ${saleFee.toFixed(2)}`);
        if (envioChanged)
          console.log(`     envio ${parsed.envio.toFixed(2)} → ${envio.toFixed(2)}`);
        if (amountChanged)
          console.log(`     amount ${bill.amount.toFixed(2)} → ${finalNet.toFixed(2)}`);

        if (!isDry) {
          await prisma.bill.update({
            where: { id: bill.id },
            data: { amount: finalNet, notes: newNotes },
          });
          if (bill.mlPackId) affectedPacks.add(`${tenantId}|${bill.mlPackId}`);
        }
        totals.atualizadas++;
      } catch (err) {
        console.log(`  ! ${bill.mlOrderId}: erro ${err instanceof Error ? err.message : err}`);
        totals.skipFalha++;
      }
    }
  });

  // Renormaliza packs afetados
  if (!isDry && affectedPacks.size > 0) {
    console.log(`\nNormalizando ${affectedPacks.size} pack(s)...`);
    for (const key of affectedPacks) {
      const [tenantId, mlPackId] = key.split('|');
      try {
        const res = await normalizePackShipping({ tenantId, mlPackId });
        if (res.touched) totals.packsNormalizados++;
      } catch (err) {
        console.log(`  ! pack ${mlPackId}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log('\n=== Totais ===');
  console.log(JSON.stringify(totals, null, 2));
  if (isDry) console.log('\n(dry-run — nada gravado. Rode sem "dry" pra aplicar.)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
