/**
 * Backfill one-off: roda normalizePackShipping em todos os packs ML
 * com 2+ bills não-canceladas. Sem efeito em venda avulsa.
 *
 * Usage:
 *   npx tsx scripts/backfill-pack-shipping.ts [dry]
 *     dry → não grava, só relata
 */
import 'dotenv/config';
import prisma from '@/lib/prisma';
import { parseSaleNotes } from '@/lib/sale-notes';
import { normalizePackShipping } from '@/lib/ml-pack-shipping';

const isDry = process.argv.includes('dry');

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  console.log(`[backfill-pack-shipping] dry=${isDry} | tenants=${tenants.length}`);

  const totals = {
    packsExaminados: 0,
    packsCorrigidos: 0,
    billsZeradas: 0,
    billsAnchorAjustadas: 0,
    enviosFantasmaRemovidos: 0,
  };

  for (const t of tenants) {
    const packGroups = await prisma.bill.groupBy({
      by: ['mlPackId'],
      where: {
        tenantId: t.id,
        type: 'receivable',
        category: 'venda',
        mlPackId: { not: null },
        status: { not: 'cancelled' },
      },
      _count: { _all: true },
    });

    const multi = packGroups.filter((g) => g._count._all > 1 && g.mlPackId);
    if (multi.length === 0) {
      console.log(`  ${t.name}: nenhum pack multi-bill.`);
      continue;
    }
    console.log(`\n>>> ${t.name}: ${multi.length} packs com 2+ bills`);
    totals.packsExaminados += multi.length;

    for (const pack of multi) {
      const mlPackId = pack.mlPackId!;

      const before = await prisma.bill.findMany({
        where: {
          tenantId: t.id,
          type: 'receivable',
          category: 'venda',
          mlPackId,
          status: { not: 'cancelled' },
        },
        select: { id: true, mlOrderId: true, notes: true },
        orderBy: { mlOrderId: 'asc' },
      });

      const res = await normalizePackShipping({ tenantId: t.id, mlPackId, dry: isDry });
      if (!res.touched) continue;

      totals.packsCorrigidos++;
      totals.billsZeradas += res.billsZeradas;
      totals.enviosFantasmaRemovidos += res.enviosFantasmaRemovidos;
      if (res.anchorAjustada) totals.billsAnchorAjustadas++;

      const after = await prisma.bill.findMany({
        where: { id: { in: before.map((b) => b.id) } },
        select: { id: true, mlOrderId: true, notes: true },
      });
      const afterMap = new Map(after.map((a) => [a.id, a]));

      console.log(`  pack #${mlPackId}`);
      for (const b of before) {
        const a = afterMap.get(b.id)!;
        const envioAntes = parseSaleNotes(b.notes).envio;
        const envioDepois = parseSaleNotes(a.notes).envio;
        const changed = envioAntes !== envioDepois;
        const marker = changed ? '→' : ' ';
        console.log(
          `    ${marker} ${b.mlOrderId} envio ${envioAntes.toFixed(2)} → ${envioDepois.toFixed(2)}`,
        );
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
