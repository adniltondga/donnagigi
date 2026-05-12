/**
 * Backfill: detecta bônus de envio ML em bills históricas e anota nas notes.
 *
 * Para cada bill ML sem "Bônus envio" nas notes, busca o shipment no ML
 * e compara o list_cost com o custo real registrado nas notes.
 * Se houver diferença > R$ 0,01, grava "Bônus envio: R$ X.XX" nas notes.
 *
 * Usage: npx tsx scripts/backfill-shipping-bonus.ts [since=YYYY-MM-DD] [dry]
 *   dry  → mostra diff mas não salva
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const isDry = process.argv.includes('dry');
const sinceArg = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const since = sinceArg
  ? new Date(sinceArg)
  : (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return d;
    })();

async function fetchShipmentBonus(
  orderId: string,
  mlToken: string,
): Promise<{ bonus: number; listedFee: number; actualFee: number } | null> {
  try {
    const id = orderId.replace(/^order_/, '');
    const orderRes = await fetch(`https://api.mercadolibre.com/orders/${id}`, {
      headers: { Authorization: `Bearer ${mlToken}` },
    });
    if (!orderRes.ok) return null;
    const order = await orderRes.json();

    const shippingId = order.shipping?.id;
    if (!shippingId) return null;

    const shipRes = await fetch(`https://api.mercadolibre.com/shipments/${shippingId}`, {
      headers: { Authorization: `Bearer ${mlToken}` },
    });
    if (!shipRes.ok) return null;
    const ship = await shipRes.json();

    const listCost: number = ship.shipping_option?.list_cost ?? 0;
    const cost: number = ship.shipping_option?.cost ?? 0;
    const compensation: number = ship.cost_components?.compensation ?? 0;
    const listedFee = Math.max(0, listCost - cost - compensation);
    return { bonus: 0, listedFee, actualFee: 0 };
  } catch {
    return null;
  }
}

function parseActualShipping(notes: string | null): number {
  if (!notes) return 0;
  return parseFloat(
    notes.match(/Taxa de envio:\s*R\$\s*([\d,.]+)/)?.[1]?.replace(',', '.') ?? '0',
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
      tenant: { select: { name: true } },
    },
  });

  for (const integ of integrations) {
    console.log(`→ ${integ.tenant.name}`);

    const bills = await prisma.bill.findMany({
      where: {
        tenantId: integ.tenantId,
        type: 'receivable',
        category: 'venda',
        mlOrderId: { not: null },
        status: { not: 'cancelled' },
        paidDate: { gte: since },
        notes: {
          contains: 'Taxa de envio',
          not: { contains: 'Bônus envio' },
        },
      },
      select: { id: true, mlOrderId: true, notes: true },
    });

    console.log(`  ${bills.length} bills a verificar`);
    let updated = 0, skipped = 0, errors = 0;

    const BATCH = 5;
    for (let i = 0; i < bills.length; i += BATCH) {
      const batch = bills.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (bill) => {
          const result = await fetchShipmentBonus(bill.mlOrderId!, integ.accessToken);
          if (!result) { errors++; return; }

          const actual = parseActualShipping(bill.notes);
          if (actual === 0) { skipped++; return; }

          const bonus = result.listedFee - actual;
          if (bonus <= 0.01) { skipped++; return; }

          // Insere "Bônus envio: R$ X.XX" após a linha "Líquido: R$ ..."
          const newNotes = bill.notes!.replace(
            /(Líquido:\s*R\$\s*[\d,.]+)/,
            `$1\nBônus envio: R$ ${bonus.toFixed(2)}`,
          );

          console.log(
            `  [${bill.mlOrderId}] envio listed=${result.listedFee.toFixed(2)} actual=${actual.toFixed(2)} bônus=${bonus.toFixed(2)}`,
          );

          if (!isDry) {
            await prisma.bill.update({ where: { id: bill.id }, data: { notes: newNotes } });
          }
          updated++;
        }),
      );
    }

    console.log(`  atualizadas: ${updated} | sem diff: ${skipped} | erros: ${errors}\n`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
