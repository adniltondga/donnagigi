/**
 * Backfill de devoluções ML — roda fora do Next.js, sem HTTP nem auth.
 * Usage: npx tsx scripts/backfill-refunds.ts [YYYY-MM-DD]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { syncRefundsForTenant } from '../src/lib/refund-sync';

const prisma = new PrismaClient();

async function main() {
  const sinceArg = process.argv[2];
  const since = sinceArg ? new Date(sinceArg) : (() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d;
  })();

  console.log(`Backfill desde: ${since.toISOString().slice(0, 10)}\n`);

  const integrations = await prisma.mLIntegration.findMany({
    where: { accessToken: { not: '' } },
    select: { tenantId: true, accessToken: true, tenant: { select: { name: true, slug: true } } },
  });

  if (integrations.length === 0) {
    console.log('Nenhuma integração ML encontrada.');
    return;
  }

  for (const integ of integrations) {
    console.log(`→ Tenant: ${integ.tenant.name} (${integ.tenant.slug})`);
    const stats = await syncRefundsForTenant({
      tenantId: integ.tenantId,
      accessToken: integ.accessToken,
      since,
    });
    console.log(`  verificadas: ${stats.verificadas}`);
    console.log(`  canceladas:  ${stats.canceladas}`);
    console.log(`  parciais:    ${stats.parciais}`);
    console.log(`  já processadas: ${stats.jaProcessadas}`);
    console.log(`  falhas:      ${stats.falhas}`);
    console.log(`  total devolvido: R$ ${stats.totalDevolvido.toFixed(2)}\n`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
