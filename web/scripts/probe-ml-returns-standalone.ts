/**
 * Probe pra ver se o ML expõe endpoints de listagem standalone de
 * returns (sem precisar passar por cada claim). Se sim, podemos
 * montar a tela de Devoluções com 1 chamada em vez de N. Só GETs.
 *
 * Usage:  npx tsx scripts/probe-ml-returns-standalone.ts
 */
import 'dotenv/config';
import { forEachMLTenant } from '@/lib/ml';

const PROBES = [
  '/post-purchase/v1/returns/search?seller=SELLER_ID',
  '/post-purchase/v2/returns/search?seller=SELLER_ID',
  '/post-purchase/v1/returns/search?role=respondent&status=opened',
  '/post-purchase/v2/returns/search?role=respondent&status=opened',
  '/post-purchase/v1/returns/search?seller_id=SELLER_ID',
  '/post-purchase/v1/sellers/SELLER_ID/returns',
  '/post-purchase/v1/sellers/SELLER_ID/returns/search',
  // Caso o ML use o mesmo claims/search com filtro de stage=return:
  '/post-purchase/v1/claims/search?stage=return&role=respondent&limit=5',
  '/post-purchase/v1/claims/search?status=opened&role=respondent&stage=return&limit=5',
  // Outra convenção comum:
  '/users/SELLER_ID/returns',
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
  await forEachMLTenant(async (integration) => {
    console.log(`\n=== seller ${integration.sellerID} ===`);
    for (const tmpl of PROBES) {
      const url =
        'https://api.mercadolibre.com' +
        tmpl.replace(/SELLER_ID/g, integration.sellerID);
      const { status, body } = await fetchJSON(url, integration.accessToken);
      const tag =
        status === 200
          ? '✓'
          : status === 404
          ? '·'
          : status === 401 || status === 403
          ? '🔒'
          : '✗';
      console.log(`  ${tag} ${status} ${tmpl}`);
      if (status === 200 || (status >= 400 && status !== 404)) {
        const preview = body.slice(0, 300).replace(/\s+/g, ' ');
        console.log(`      ${preview}`);
      }
    }
  });
}

main()
  .catch((e) => {
    console.error('falha:', e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
