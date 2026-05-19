/**
 * Probe pra mapear quais endpoints de return/refund/evidência o ML
 * expõe pras claims atuais do tenant. Só GETs — zero risco.
 *
 * Usage:  npx tsx scripts/probe-ml-claim-returns.ts
 */
import 'dotenv/config';
import { forEachMLTenant } from '@/lib/ml';
import { listClaims } from '@/lib/ml-claims';

const PROBES = [
  // Returns (provavelmente o mais útil)
  '/post-purchase/v1/claims/{id}/returns',
  '/post-purchase/v2/claims/{id}/returns',
  '/post-purchase/v1/claims/{id}/return',
  // Resoluções esperadas / oferecidas
  '/post-purchase/v1/claims/{id}/expected-resolutions',
  '/post-purchase/v1/claims/{id}/resolutions',
  // Ações disponíveis
  '/post-purchase/v1/claims/{id}/players/respondent/available-actions',
  '/post-purchase/v1/claims/{id}/actions',
  // Evidências e anexos
  '/post-purchase/v1/claims/{id}/evidences',
  '/post-purchase/v1/claims/{id}/attachments',
];

async function fetchJSON(url: string, token: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function main() {
  await forEachMLTenant(async (integration, tenantId) => {
    console.log(`\n=== tenant ${tenantId} ===`);
    const list = await listClaims(integration, {
      status: 'opened',
      limit: 50,
    });

    for (const claim of list.data) {
      console.log(
        `\n--- claim ${claim.id} (stage=${claim.stage}, type=${claim.type}) ---`,
      );

      for (const tmpl of PROBES) {
        const url =
          'https://api.mercadolibre.com' +
          tmpl.replace('{id}', String(claim.id));
        const { status, body } = await fetchJSON(url, integration.accessToken);
        const tag =
          status === 200
            ? '✓'
            : status === 404
            ? '·'
            : status === 401 || status === 403
            ? '🔒'
            : '✗';
        const preview = body.slice(0, 240).replace(/\s+/g, ' ');
        console.log(`  ${tag} ${status} ${tmpl}`);
        if (status === 200 || (status >= 400 && status !== 404)) {
          console.log(`      ${preview}`);
        }
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
