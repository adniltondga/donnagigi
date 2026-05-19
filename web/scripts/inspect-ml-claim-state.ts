/**
 * Pra cada claim em aberto, mostra:
 *  - players[].available_actions (revela "tá com bola na sua mão?")
 *  - última mensagem da thread (quem mandou + quando)
 *  - last_updated da claim
 *
 * Roteia pra decidir como sinalizar "já respondi" / "aguardando MP" / "aguardando
 * comprador" sem inventar campos.
 *
 * Usage:  npx tsx scripts/inspect-ml-claim-state.ts
 */
import 'dotenv/config';
import { forEachMLTenant } from '@/lib/ml';
import {
  listClaims,
  getClaim,
  getClaimMessages,
} from '@/lib/ml-claims';

async function main() {
  await forEachMLTenant(async (integration, tenantId) => {
    console.log(`\n=== tenant ${tenantId} / seller ${integration.sellerID} ===`);
    const list = await listClaims(integration, {
      status: 'opened',
      limit: 50,
    });
    console.log(`total claims abertas: ${list.paging.total}`);

    for (const item of list.data) {
      console.log(`\n--- claim ${item.id} (stage=${item.stage}) ---`);
      console.log(`  lastUpdated: ${item.lastUpdated}`);

      try {
        const [detail, messages] = await Promise.all([
          getClaim(integration, item.id),
          getClaimMessages(integration, item.id),
        ]);

        for (const p of detail.players) {
          console.log(
            `  player ${p.role} (${p.type}): actions=${JSON.stringify(p.availableActions)}`,
          );
        }

        const last = messages.length > 0 ? messages[messages.length - 1] : null;
        console.log(
          `  total mensagens: ${messages.length}, última: ${
            last
              ? `${last.senderRole} → ${last.receiverRole} @ ${last.dateCreated ?? '?'}`
              : '(nenhuma)'
          }`,
        );
      } catch (err) {
        console.log(
          `  ✗ erro: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  });
}

main()
  .catch((err) => {
    console.error('falha:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
