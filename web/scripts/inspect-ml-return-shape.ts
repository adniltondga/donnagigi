/**
 * Pega o JSON completo de /post-purchase/v2/claims/{id}/returns pra
 * tipar corretamente. Só GET — zero risco.
 *
 * Usage:  npx tsx scripts/inspect-ml-return-shape.ts
 */
import 'dotenv/config';
import { forEachMLTenant } from '@/lib/ml';
import { listClaims } from '@/lib/ml-claims';

async function main() {
  await forEachMLTenant(async (integration) => {
    const list = await listClaims(integration, {
      status: 'opened',
      limit: 10,
    });

    for (const claim of list.data) {
      const url = `https://api.mercadolibre.com/post-purchase/v2/claims/${claim.id}/returns`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          Accept: 'application/json',
        },
      });
      if (res.status !== 200) {
        console.log(`\nclaim ${claim.id}: ${res.status} (skip)`);
        continue;
      }
      const body = await res.json();
      console.log(`\n=== claim ${claim.id} → /returns ===`);
      console.log(JSON.stringify(body, null, 2));
    }
  });
}

main()
  .catch((err) => {
    console.error('falha:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
