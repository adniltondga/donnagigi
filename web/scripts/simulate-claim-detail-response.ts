/**
 * Reproduz EXATAMENTE o que GET /api/ml/claims/:id retorna pra cada
 * claim aberta. Se o campo `return` aparece aqui mas não na tela do
 * app, o problema está no app (cache, OTA não pegou, render condicional).
 * Se não aparece aqui, está no backend.
 *
 * Usage:  npx tsx scripts/simulate-claim-detail-response.ts
 */
import 'dotenv/config';
import { forEachMLTenant } from '@/lib/ml';
import {
  getClaim,
  getClaimEvidences,
  getClaimExpectedResolutions,
  getClaimMessages,
  getClaimReturn,
  listClaims,
} from '@/lib/ml-claims';

async function main() {
  await forEachMLTenant(async (integration) => {
    const list = await listClaims(integration, {
      status: 'opened',
      limit: 10,
    });

    for (const c of list.data) {
      const [claim, messages, expectedResolutions, ret, evidences] =
        await Promise.all([
          getClaim(integration, c.id),
          getClaimMessages(integration, c.id),
          getClaimExpectedResolutions(integration, c.id),
          getClaimReturn(integration, c.id),
          getClaimEvidences(integration, c.id),
        ]);

      console.log(`\n=== claim ${c.id} ===`);
      console.log(`  claim.status: ${claim.status}`);
      console.log(`  messages: ${messages.length}`);
      console.log(
        `  expectedResolutions: ${expectedResolutions.length} ${
          expectedResolutions[0]?.expectedResolution ?? ''
        }`,
      );
      console.log(`  return: ${ret ? 'SIM' : 'null'}`);
      if (ret) {
        console.log(`    status: ${ret.status}`);
        console.log(`    statusMoney: ${ret.statusMoney}`);
        console.log(`    subtype: ${ret.subtype}`);
        console.log(
          `    tracking: ${ret.shipments[0]?.trackingNumber ?? '—'}`,
        );
      }
      console.log(`  evidences: ${evidences.length}`);
    }
  });
}

main()
  .catch((e) => {
    console.error('falha:', e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
