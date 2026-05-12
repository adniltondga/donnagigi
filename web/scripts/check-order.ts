import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORDER_ID = process.argv[2] || '2000016396422360';

async function main() {
  const integ = await prisma.mLIntegration.findFirst({
    where: { accessToken: { not: '' } },
    select: { accessToken: true },
  });
  if (!integ) { console.error('Sem integração ML'); return; }

  const headers = { Authorization: `Bearer ${integ.accessToken}`, Accept: 'application/json' };

  const res = await fetch(`https://api.mercadolibre.com/orders/${ORDER_ID}`, { headers });
  const order = await res.json();

  console.log('\n=== ORDER TOP LEVEL ===');
  console.log('total_amount:     ', order.total_amount);
  console.log('coupon_amount:    ', order.coupon_amount);
  console.log('status:           ', order.status);

  console.log('\n=== PAYMENTS (todos os campos) ===');
  for (const p of order.payments ?? []) {
    console.log(JSON.stringify(p, null, 2));
  }

  console.log('\n=== SHIPPING ===');
  if (order.shipping?.id) {
    const sRes = await fetch(`https://api.mercadolibre.com/shipments/${order.shipping.id}`, { headers });
    const ship = await sRes.json();
    console.log('shipping_option:  ', JSON.stringify(ship.shipping_option));
    console.log('cost_components:  ', JSON.stringify(ship.cost_components));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
