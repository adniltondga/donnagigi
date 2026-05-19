/**
 * Smoke test: ver se o token ML atual do tenant tem permissão de ler
 * claims. Se retornar 200 → seguimos com o roadmap de claims sem
 * precisar refazer OAuth. Se 401/403 → cliente precisa reautorizar
 * com scopes novos antes de qualquer feature de claims.
 *
 * Usage:  npx tsx scripts/check-ml-claims-scope.ts
 */
import 'dotenv/config';
import { forEachMLTenant } from '@/lib/ml';

type Probe = {
  label: string;
  url: string;
};

const probes: Probe[] = [
  {
    label: 'claims/search (seller role=respondent, status=opened)',
    url: 'https://api.mercadolibre.com/post-purchase/v1/claims/search?status=opened&role=respondent&limit=5',
  },
  {
    label: 'claims/search (sem filtro)',
    url: 'https://api.mercadolibre.com/post-purchase/v1/claims/search?limit=5',
  },
];

async function fetchJSON(url: string, token: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const body = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(body);
  } catch {}
  return { status: res.status, body, parsed };
}

async function main() {
  await forEachMLTenant(async (integration, tenantId) => {
    console.log('\n========================================');
    console.log(`tenant: ${tenantId}`);
    console.log(`seller: ${integration.sellerID}`);
    console.log(`token expira: ${integration.expiresAt.toISOString()}`);
    console.log('========================================');

    let firstClaimId: number | null = null;

    for (const probe of probes) {
      console.log(`\n→ ${probe.label}`);
      console.log(`  ${probe.url}`);
      const { status, body, parsed } = await fetchJSON(
        probe.url,
        integration.accessToken,
      );
      console.log(`  status: ${status}`);
      if (status === 200) {
        const obj = parsed as Record<string, unknown> | null;
        const data = obj?.data as unknown[] | undefined;
        const paging = obj?.paging as Record<string, unknown> | undefined;
        console.log(
          `  ✓ OK — ${data?.length ?? '?'} itens nesta página, total=${
            paging?.total ?? '?'
          }`,
        );
        if (Array.isArray(data) && data.length > 0 && !firstClaimId) {
          const first = data[0] as Record<string, unknown>;
          firstClaimId =
            typeof first.id === 'number' ? first.id : Number(first.id);
          console.log(
            `    primeiro item keys: ${Object.keys(first).slice(0, 10).join(', ')}`,
          );
        }
      } else {
        console.log(`  ✗ corpo: ${body.slice(0, 400)}`);
      }
    }

    if (!firstClaimId) {
      console.log('\n(sem claim em aberto pra inspecionar shape)');
      return;
    }

    console.log(`\n--- inspecionando shape com claim ${firstClaimId} ---`);

    const detailUrl = `https://api.mercadolibre.com/post-purchase/v1/claims/${firstClaimId}`;
    console.log(`\n→ detalhe: ${detailUrl}`);
    const det = await fetchJSON(detailUrl, integration.accessToken);
    console.log(`  status: ${det.status}`);
    if (det.status === 200) {
      const obj = det.parsed as Record<string, unknown>;
      console.log(`  keys: ${Object.keys(obj).join(', ')}`);
      // mostra um sample pequeno (sem dados sensíveis pesados)
      const sample = JSON.stringify(obj).slice(0, 800);
      console.log(`  sample(800ch): ${sample}`);
    } else {
      console.log(`  corpo: ${det.body.slice(0, 400)}`);
    }

    const msgsUrl = `https://api.mercadolibre.com/post-purchase/v1/claims/${firstClaimId}/messages`;
    console.log(`\n→ mensagens: ${msgsUrl}`);
    const msgs = await fetchJSON(msgsUrl, integration.accessToken);
    console.log(`  status: ${msgs.status}`);
    if (msgs.status === 200) {
      const obj = msgs.parsed as Record<string, unknown>;
      console.log(`  keys: ${Object.keys(obj).join(', ')}`);
      const messages = (obj.messages || obj.data) as unknown[] | undefined;
      console.log(`  total messages: ${messages?.length ?? '?'}`);
      if (Array.isArray(messages) && messages.length > 0) {
        const first = messages[0] as Record<string, unknown>;
        console.log(`  primeira msg keys: ${Object.keys(first).join(', ')}`);
        const sample = JSON.stringify(first).slice(0, 600);
        console.log(`  primeira msg sample: ${sample}`);
      } else {
        const sample = JSON.stringify(obj).slice(0, 600);
        console.log(`  payload sample: ${sample}`);
      }
    } else {
      console.log(`  corpo: ${msgs.body.slice(0, 400)}`);
    }
  });
}

main()
  .catch((err) => {
    console.error('falha:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
