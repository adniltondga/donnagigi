/**
 * Deleta fatura(s) em aberto/atrasadas de um usuário (por email).
 *
 * Cancela primeiro o payment na ASAAS (DELETE /payments/{id}) e depois
 * remove o Invoice local. Pula faturas já CONFIRMED/RECEIVED.
 *
 * Uso:
 *   node scripts/delete-overdue-invoice.js <email>                          # dry-run, todas em aberto
 *   node scripts/delete-overdue-invoice.js <email> --status=OVERDUE         # filtra por status
 *   node scripts/delete-overdue-invoice.js <email> --id=<invoiceId>         # filtra por id local
 *   node scripts/delete-overdue-invoice.js <email> ... --confirm            # executa
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DELETABLE_STATUSES = new Set(['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS']);

async function asaasDeletePayment(paymentId) {
  const baseUrl = process.env.ASAAS_API_URL || 'https://api-sandbox.asaas.com/v3';
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error('ASAAS_API_KEY não configurada');

  const res = await fetch(`${baseUrl}/payments/${paymentId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'aglivre',
      access_token: apiKey,
    },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const detail =
      body?.errors?.map((e) => e.description).filter(Boolean).join('; ') ||
      body?.message ||
      `${res.status} ${res.statusText}`;
    throw new Error(`ASAAS DELETE /payments/${paymentId}: ${detail}`);
  }
  return body;
}

async function main() {
  const email = process.argv[2];
  const confirm = process.argv.includes('--confirm');
  const statusArg = (process.argv.find((a) => a.startsWith('--status=')) || '').split('=')[1];
  const idArg = (process.argv.find((a) => a.startsWith('--id=')) || '').split('=')[1];
  const skipAsaas = process.argv.includes('--skip-asaas');

  if (!email) {
    console.error('Uso: node scripts/delete-overdue-invoice.js <email> [--status=OVERDUE|--id=<id>] [--confirm]');
    process.exit(1);
  }

  console.log(`\n[${confirm ? 'EXECUTAR' : 'DRY-RUN'}] email=${email}`);
  console.log(`ASAAS_API_URL=${process.env.ASAAS_API_URL || '(default sandbox)'}\n`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      tenant: {
        include: {
          subscription: {
            include: {
              invoices: { orderBy: { dueDate: 'desc' } },
            },
          },
        },
      },
    },
  });

  if (!user) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  console.log(`User:         ${user.name} (${user.email}) role=${user.role}`);
  console.log(`Tenant:       ${user.tenant.name} (slug=${user.tenant.slug})`);

  const sub = user.tenant.subscription;
  if (!sub) {
    console.error('Tenant não tem subscription.');
    process.exit(1);
  }
  console.log(`Subscription: id=${sub.id} plan=${sub.plan} status=${sub.status} asaasSub=${sub.asaasSubscriptionId}`);
  console.log(`Invoices (${sub.invoices.length}):`);
  for (const inv of sub.invoices) {
    console.log(
      `  - ${inv.id}  status=${inv.status.padEnd(10)} value=${inv.value}  due=${inv.dueDate.toISOString().slice(0,10)}  asaas=${inv.asaasPaymentId}`
    );
  }

  let toDelete = sub.invoices.filter((i) => DELETABLE_STATUSES.has(i.status));
  if (statusArg) toDelete = toDelete.filter((i) => i.status === statusArg);
  if (idArg) toDelete = toDelete.filter((i) => i.id === idArg);
  const filterDesc =
    idArg ? `id=${idArg}` :
    statusArg ? `status=${statusArg}` :
    `em aberto (${[...DELETABLE_STATUSES].join('/')})`;
  console.log(`\nFaturas a deletar [${filterDesc}]: ${toDelete.length}`);
  if (toDelete.length === 0) {
    console.log('Nada a fazer.');
    return;
  }
  for (const inv of toDelete) {
    console.log(`  → ${inv.id} (asaas ${inv.asaasPaymentId}) status=${inv.status} R$ ${inv.value}`);
  }

  if (!confirm) {
    console.log('\nDRY-RUN: nada foi alterado. Re-execute com --confirm pra deletar.');
    return;
  }

  console.log('\nExecutando deleções...');
  for (const inv of toDelete) {
    if (!skipAsaas) {
      try {
        console.log(`ASAAS DELETE /payments/${inv.asaasPaymentId} ...`);
        await asaasDeletePayment(inv.asaasPaymentId);
        console.log('  ✓ ASAAS deletou');
      } catch (e) {
        console.error(`  ✗ ASAAS falhou: ${e.message}`);
        console.error('  Abortando — Invoice local NÃO foi removido.');
        continue;
      }
    } else {
      console.log(`  (--skip-asaas) pulando DELETE na ASAAS pra ${inv.asaasPaymentId}`);
    }
    await prisma.invoice.delete({ where: { id: inv.id } });
    console.log(`  ✓ Invoice local ${inv.id} removido`);
  }
  console.log('\nConcluído.');
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
