import 'dotenv/config';
import prisma from '@/lib/prisma';

async function main() {
  const b = await prisma.bill.findFirst({
    where: { mlOrderId: 'order_2000016525504222' },
    select: {
      id: true,
      description: true,
      isExchange: true,
      mlOrderId: true,
      mlPackId: true,
      amount: true,
      paidDate: true,
    },
  });
  console.log(JSON.stringify(b, null, 2));
}

main().finally(() => process.exit(0));
