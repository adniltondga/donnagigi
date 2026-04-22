/**
 * Backfill: re-consulta a API do ML para cada Bill de venda e,
 * se agora existe order_items[].sale_fee, ajusta:
 *   - Bill.amount -= saleFee
 *   - Notes ganham de volta a linha "Taxa de venda: R$ X" (no breakdown VENDAS)
 *
 * Idempotente: só atualiza bills que ainda NÃO têm "Taxa de venda" em notes.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

async function refreshTokenIfNeeded(integration) {
  if (new Date() <= integration.expiresAt) return integration;
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

(async () => {
  loadEnv();

  let integration = await prisma.mLIntegration.findFirst();
  if (!integration) {
    console.error('sem integração ML');
    process.exit(1);
  }
  integration = await refreshTokenIfNeeded(integration);
  const headers = { Authorization: `Bearer ${integration.accessToken}` };

  // Bills de venda ML que AINDA NÃO têm "Taxa de venda" em notes
  const bills = await prisma.bill.findMany({
    where: {
      type: 'receivable',
      category: 'venda',
      mlOrderId: { not: null },
      NOT: { notes: { contains: 'Taxa de venda' } },
    },
    select: { id: true, mlOrderId: true, amount: true, notes: true },
  });

  console.log(`Processando ${bills.length} bills...`);

  let updated = 0;
  let zeros = 0;
  let fails = 0;

  for (const b of bills) {
    const orderId = b.mlOrderId.replace(/^order_/, '');
    try {
      const res = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, { headers });
      if (!res.ok) {
        console.log(`  fail ${b.id} (${orderId}): ${res.status}`);
        fails++;
        continue;
      }
      const order = await res.json();
      const saleFee = (order.order_items || []).reduce(
        (s, it) => s + (Number(it.sale_fee) || 0),
        0
      );

      if (saleFee === 0) {
        zeros++;
        continue; // ainda não liquidado
      }

      // Atualiza amount (subtrai saleFee)
      const newAmount = b.amount - saleFee;

      // Atualiza linha VENDAS nas notes: adiciona "Taxa de venda" antes de envio
      let newNotes = b.notes || '';
      const vendasLineRe = /VENDAS\n([^\n]*)/;
      const m = newNotes.match(vendasLineRe);
      if (m) {
        let inner = m[1];
        // Encontrar "Taxas: ...(Total: R$ X)" e reescrever
        const envioMatch = inner.match(/Taxa de envio:\s*R\$\s*([\d,\.]+)/);
        const envio = envioMatch ? parseFloat(envioMatch[1].replace(',', '.')) : 0;
        const brutoMatch = inner.match(/Bruto:\s*R\$\s*([\d,\.]+)/);
        const bruto = brutoMatch ? parseFloat(brutoMatch[1].replace(',', '.')) : null;
        const liquido = bruto !== null ? bruto - envio - saleFee : newAmount;
        const totalTaxas = envio + saleFee;

        const newLine = `VENDAS\nBruto: R$ ${(bruto ?? 0).toFixed(
          2
        )} | Taxas: Taxa de venda: R$ ${saleFee.toFixed(2)} + Taxa de envio: R$ ${envio.toFixed(
          2
        )} (Total: R$ ${totalTaxas.toFixed(2)}) | Líquido: R$ ${liquido.toFixed(2)}`;

        newNotes = newNotes.replace(/VENDAS\n[^\n]*/, newLine);
      }

      await prisma.bill.update({
        where: { id: b.id },
        data: { amount: newAmount, notes: newNotes },
      });

      console.log(
        `  ok ${b.id} | saleFee ${saleFee.toFixed(2)} | amount ${b.amount.toFixed(
          2
        )} → ${newAmount.toFixed(2)}`
      );
      updated++;
    } catch (e) {
      console.log(`  fail ${b.id} (${orderId}): ${e.message}`);
      fails++;
    }
  }

  console.log(
    `\n✅ Backfill concluído: ${updated} atualizadas · ${zeros} sem saleFee (ainda) · ${fails} falhas`
  );
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
