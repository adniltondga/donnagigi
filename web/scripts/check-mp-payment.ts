import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PAYMENT_ID = process.argv[2] || '158188514575';

async function main() {
  const integ = await prisma.mPIntegration.findFirst({
    where: { accessToken: { not: '' } },
    select: { accessToken: true },
  });
  if (!integ) { console.error('Sem integração MP'); return; }

  const headers = { Authorization: `Bearer ${integ.accessToken}`, Accept: 'application/json' };

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${PAYMENT_ID}`, { headers });
  const p = await res.json();

  if (p.error) { console.error('Erro MP:', p); return; }

  console.log('\n=== VALORES PRINCIPAIS ===');
  console.log('transaction_amount:         ', p.transaction_amount);
  console.log('total_paid_amount:          ', p.total_paid_amount);
  console.log('transaction_amount_refunded:', p.transaction_amount_refunded);
  console.log('coupon_amount:              ', p.coupon_amount);
  console.log('net_received_amount (root): ', p.net_received_amount);

  console.log('\n=== TRANSACTION DETAILS ===');
  console.log(JSON.stringify(p.transaction_details, null, 2));

  console.log('\n=== FEE DETAILS ===');
  for (const f of p.fee_details ?? []) {
    console.log(`  type=${f.type}  amount=${f.amount}  fee_payer=${f.fee_payer}`);
  }

  console.log('\n=== MONEY RELEASE / STATUS ===');
  console.log('status:              ', p.status);
  console.log('status_detail:       ', p.status_detail);
  console.log('money_release_date:  ', p.money_release_date);
  console.log('date_approved:       ', p.date_approved);

  // Tenta o extrato de movimentos via endpoint de releases
  const movRes = await fetch(
    `https://api.mercadopago.com/v1/account/movements?payment_id=${PAYMENT_ID}`,
    { headers }
  );
  if (movRes.ok) {
    const mov = await movRes.json();
    console.log('\n=== MOVEMENTS ===');
    console.log(JSON.stringify(mov, null, 2));
  } else {
    // Tenta endpoint alternativo de settlements
    const sRes = await fetch(
      `https://api.mercadopago.com/v1/account/balance/search?type=payment&external_reference=${PAYMENT_ID}`,
      { headers }
    );
    const s = sRes.ok ? await sRes.json() : { status: sRes.status };
    console.log('\n=== BALANCE SEARCH ===');
    console.log(JSON.stringify(s).slice(0, 500));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
