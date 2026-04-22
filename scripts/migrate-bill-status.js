/**
 * Migração única: ajusta status das Bills de venda ML existentes.
 *
 * Regra: Bills com paidDate + 30 dias >= hoje (ainda não liberadas pelo ML)
 * viram "pending". Bills mais antigas ficam como "paid" (já caíram na conta).
 *
 * Também atualiza dueDate pra refletir a data estimada de liberação.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const bills = await prisma.bill.findMany({
    where: {
      type: 'receivable',
      category: 'venda',
      status: 'paid',
      mlOrderId: { not: null },
    },
    select: { id: true, paidDate: true, dueDate: true },
  });

  const now = new Date();
  let setPending = 0;
  let keptPaid = 0;

  for (const b of bills) {
    if (!b.paidDate) continue;
    const release = new Date(b.paidDate);
    release.setDate(release.getDate() + 30);

    if (release > now) {
      // Ainda não liberado pelo ML → pending
      await prisma.bill.update({
        where: { id: b.id },
        data: { status: 'pending', dueDate: release },
      });
      setPending++;
    } else {
      // Já liberou → mantém paid, mas ajusta dueDate
      await prisma.bill.update({
        where: { id: b.id },
        data: { dueDate: release },
      });
      keptPaid++;
    }
  }

  console.log(`✅ Migração concluída: ${setPending} → pending, ${keptPaid} mantidas como paid`);
  await prisma.$disconnect();
})();
