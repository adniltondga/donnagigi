/**
 * Investiga 1 order específico no ML pra descobrir como troca é
 * sinalizada no payload (tags, mediations, parent_order_id, etc).
 * Também tenta achar a claim associada.
 *
 * Usage:  npx tsx scripts/inspect-ml-exchange-order.ts <orderId>
 */
import 'dotenv/config';
import { forEachMLTenant } from '@/lib/ml';

const orderId = process.argv[2];
if (!orderId) {
  console.error('Uso: npx tsx scripts/inspect-ml-exchange-order.ts <orderId>');
  process.exit(1);
}

async function fetchJSON(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function main() {
  await forEachMLTenant(async (integration) => {
    console.log(`\n=== seller ${integration.sellerID} ===`);

    // 1. Detalhe completo do order
    console.log(`\n→ GET /orders/${orderId}`);
    const ord = await fetchJSON(
      `https://api.mercadolibre.com/orders/${orderId}`,
      integration.accessToken,
    );
    console.log(`  status: ${ord.status}`);
    if (ord.status === 200) {
      const o = JSON.parse(ord.body);
      // Foco nos campos que tipicamente indicam troca:
      console.log(`  tags: ${JSON.stringify(o.tags)}`);
      console.log(`  status: ${o.status}, status_detail: ${o.status_detail}`);
      console.log(`  mediations: ${JSON.stringify(o.mediations)}`);
      console.log(`  context: ${JSON.stringify(o.context)}`);
      console.log(`  pack_id: ${o.pack_id}`);
      console.log(`  order_request: ${JSON.stringify(o.order_request)}`);
      // Imprime todas as keys top-level pra não perder nada
      console.log(`  ALL keys: ${Object.keys(o).join(', ')}`);
    } else {
      console.log(`  body: ${ord.body.slice(0, 400)}`);
    }

    // 2. Tem mediação? Vamos buscar claim associada via pack/order
    console.log(`\n→ GET /post-purchase/v1/claims/search?resource_id=${orderId}`);
    const cls = await fetchJSON(
      `https://api.mercadolibre.com/post-purchase/v1/claims/search?resource_id=${orderId}&resource=order&limit=5`,
      integration.accessToken,
    );
    console.log(`  status: ${cls.status}`);
    if (cls.status === 200) {
      const data = JSON.parse(cls.body);
      console.log(`  paging.total: ${data.paging?.total}`);
      if (data.data?.length > 0) {
        for (const c of data.data) {
          console.log(
            `  claim ${c.id}: status=${c.status}, type=${c.type}, stage=${c.stage}, reason=${c.reason_id}`,
          );
        }
      }
    } else {
      console.log(`  body: ${cls.body.slice(0, 300)}`);
    }
  });
}

main()
  .catch((e) => {
    console.error('falha:', e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
