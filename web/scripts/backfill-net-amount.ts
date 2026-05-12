/**
 * Backfill: reconcilia bill.amount e a taxa de envio nas notes com o
 * net_received_amount real do Mercado Pago, para todos os pedidos ML
 * do tenant que têm integração MP configurada.
 *
 * Usage: npx tsx scripts/backfill-net-amount.ts [since=YYYY-MM-DD] [dry]
 *   dry  → mostra diff mas não salva
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const isDry = process.argv.includes('dry');
const sinceArg = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const since = sinceArg ? new Date(sinceArg) : (() => {
  const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d;
})();

async function fetchMPNet(paymentId: string, mpToken: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const net: unknown = data?.transaction_details?.net_received_amount;
    return typeof net === 'number' && net > 0 ? net : null;
  } catch { return null; }
}

async function fetchMLPaymentId(orderId: string, mlToken: string): Promise<string | null> {
  try {
    const id = orderId.replace(/^order_/, '');
    const res = await fetch(`https://api.mercadolibre.com/orders/${id}`, {
      headers: { Authorization: `Bearer ${mlToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pid = data?.payments?.[0]?.id;
    return pid != null ? String(pid) : null;
  } catch { return null; }
}

function parseBrutoAndSaleFee(notes: string | null) {
  if (!notes) return { bruto: 0, saleFee: 0 };
  const bruto = parseFloat(notes.match(/Bruto:\s*R\$\s*([\d,.]+)/)?.[1]?.replace(',', '.') ?? '0');
  const saleFee = parseFloat(notes.match(/Taxa de venda:\s*R\$\s*([\d,.]+)/)?.[1]?.replace(',', '.') ?? '0');
  return { bruto, saleFee };
}

function updateNotesShipping(notes: string, oldFee: number, newFee: number): string {
  // Substitui "Taxa de envio: R$ X.XX" nas notes
  return notes
    .replace(
      /Taxa de envio:\s*R\$\s*[\d,.]+/g,
      `Taxa de envio: R$ ${newFee.toFixed(2)}`,
    )
    .replace(
      // Recalcula o "Total: R$ X.XX" nas VENDAS do notes
      /\(Total:\s*R\$\s*[\d,.]+\)/g,
      (m) => {
        const totalMatch = m.match(/([\d,.]+)/);
        if (!totalMatch) return m;
        const oldTotal = parseFloat(totalMatch[1].replace(',', '.'));
        const diff = newFee - oldFee;
        return `(Total: R$ ${(oldTotal + diff).toFixed(2)})`;
      },
    )
    .replace(
      // Recalcula "Líquido: R$ X.XX"
      /Líquido:\s*R\$\s*[\d,.]+/g,
      (_m) => `Líquido: R$ ${(parseFloat(notes.match(/Bruto:\s*R\$\s*([\d,.]+)/)?.[1]?.replace(',', '.') ?? '0') - parseFloat(notes.match(/Taxa de venda:\s*R\$\s*([\d,.]+)/)?.[1]?.replace(',', '.') ?? '0') - newFee).toFixed(2)}`,
    );
}

async function main() {
  console.log(`Modo: ${isDry ? 'DRY RUN' : 'ESCRITA'}`);
  console.log(`Desde: ${since.toISOString().slice(0, 10)}\n`);

  const integrations = await prisma.mLIntegration.findMany({
    where: { accessToken: { not: '' } },
    select: {
      tenantId: true,
      accessToken: true,
      tenant: {
        select: {
          name: true,
          mpIntegration: { select: { accessToken: true } },
        },
      },
    },
  });

  for (const integ of integrations) {
    const mpToken = integ.tenant.mpIntegration?.accessToken;
    if (!mpToken) {
      console.log(`→ ${integ.tenant.name}: sem integração MP — pulando\n`);
      continue;
    }

    console.log(`→ ${integ.tenant.name}`);

    const bills = await prisma.bill.findMany({
      where: {
        tenantId: integ.tenantId,
        type: 'receivable',
        category: 'venda',
        mlOrderId: { not: null },
        status: { not: 'cancelled' },
        paidDate: { gte: since },
      },
      select: { id: true, mlOrderId: true, amount: true, notes: true },
    });

    console.log(`  ${bills.length} bills a verificar`);

    let updated = 0, skipped = 0, errors = 0;

    const BATCH = 5;
    for (let i = 0; i < bills.length; i += BATCH) {
      const batch = bills.slice(i, i + BATCH);
      await Promise.all(batch.map(async (bill) => {
        const mlOrderId = bill.mlOrderId!;
        const paymentId = await fetchMLPaymentId(mlOrderId, integ.accessToken);
        if (!paymentId) { errors++; return; }

        const mpNet = await fetchMPNet(paymentId, mpToken);
        if (mpNet === null) { errors++; return; }

        const { bruto, saleFee } = parseBrutoAndSaleFee(bill.notes);
        if (bruto === 0 || saleFee === 0) { skipped++; return; }

        const newShipping = Math.max(0, bruto - saleFee - mpNet);
        const oldShipping = parseFloat(
          bill.notes?.match(/Taxa de envio:\s*R\$\s*([\d,.]+)/)?.[1]?.replace(',', '.') ?? '0'
        );

        if (Math.abs(mpNet - bill.amount) <= 0.01) { skipped++; return; }

        const newNotes = bill.notes ? updateNotesShipping(bill.notes, oldShipping, newShipping) : bill.notes;

        console.log(`  [${mlOrderId}] amount ${bill.amount.toFixed(2)} → ${mpNet.toFixed(2)} | envio ${oldShipping.toFixed(2)} → ${newShipping.toFixed(2)}`);

        if (!isDry) {
          await prisma.bill.update({
            where: { id: bill.id },
            data: { amount: mpNet, notes: newNotes },
          });
        }
        updated++;
      }));
    }

    console.log(`  atualizadas: ${updated} | sem diff: ${skipped} | erros: ${errors}\n`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
