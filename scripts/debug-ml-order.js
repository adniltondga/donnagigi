/**
 * Baixa o JSON cru de um pedido ML para descobrir quais campos
 * contêm a "Tarifa de venda / Tarifa de 18%".
 *
 * Uso: node scripts/debug-ml-order.js [mlOrderId]
 *   - sem argumento: usa o pedido mais recente do banco
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function refreshTokenIfNeeded(integration) {
  if (new Date() <= integration.expiresAt) return integration;
  if (!integration.refreshToken) throw new Error('sem refresh token');
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    refresh_token: integration.refreshToken,
  });
  const r = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    body: params.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const d = await r.json();
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + d.expires_in);
  return prisma.mLIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: d.access_token,
      refreshToken: d.refresh_token || integration.refreshToken,
      expiresAt,
    },
  });
}

// Mini parser de .env (evita dependência de dotenv)
function loadEnv() {
  const fs = require('fs');
  const path = require('path');
  try {
    const content = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }
    }
  } catch {}
}

(async () => {
  loadEnv();

  let integration = await prisma.mLIntegration.findFirst();
  if (!integration) {
    console.error('sem integração ML');
    process.exit(1);
  }
  integration = await refreshTokenIfNeeded(integration);

  let orderId = process.argv[2];
  if (!orderId) {
    const lastBill = await prisma.bill.findFirst({
      where: { mlOrderId: { not: null } },
      orderBy: { paidDate: 'desc' },
      select: { mlOrderId: true },
    });
    orderId = lastBill?.mlOrderId?.replace(/^order_/, '');
    console.log(`usando último pedido do banco: ${orderId}\n`);
  }

  if (!orderId) {
    console.error('informe um mlOrderId');
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${integration.accessToken}` };

  console.log('=== /orders/' + orderId + ' ===');
  const orderRes = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, { headers });
  if (!orderRes.ok) {
    console.error('erro', orderRes.status, await orderRes.text());
    process.exit(1);
  }
  const order = await orderRes.json();
  console.log(JSON.stringify(order, null, 2));

  // payments[].id → /billing/integration/periods/... ou /v1/payments/<id>
  if (order.payments?.length) {
    for (const p of order.payments) {
      console.log(`\n=== /v1/payments/${p.id} ===`);
      const payRes = await fetch(`https://api.mercadolibre.com/v1/payments/${p.id}`, { headers });
      if (payRes.ok) {
        console.log(JSON.stringify(await payRes.json(), null, 2));
      } else {
        console.log('skip (status ' + payRes.status + ')');
      }
    }
  }

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
