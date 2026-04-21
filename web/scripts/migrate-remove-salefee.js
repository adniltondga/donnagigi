/**
 * Migração única: remove "Taxa de venda" de Bills de venda ML.
 *
 * Para cada Bill com "Taxa de venda: R$ X" em notes:
 *   - amount passa a ser (gross - envio), em vez de (gross - saleFee - envio)
 *   - Linha VENDAS nas notes é reescrita sem a saleFee e com Total/Líquido
 *     recalculados.
 *
 * Idempotente: roda 2 vezes e na segunda não acha "Taxa de venda", nada faz.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const bills = await prisma.bill.findMany({
    where: {
      type: 'receivable',
      category: 'venda',
      notes: { contains: 'Taxa de venda' },
    },
  });

  console.log(`Encontradas ${bills.length} bills com "Taxa de venda" em notes`);

  let updated = 0;
  let skipped = 0;

  for (const b of bills) {
    if (!b.notes) {
      skipped++;
      continue;
    }

    const saleFeeMatch = b.notes.match(/Taxa de venda:\s*R\$\s*([\d,\.]+)/);
    const envioMatch = b.notes.match(/Taxa de envio:\s*R\$\s*([\d,\.]+)/);
    const brutoMatch = b.notes.match(/Bruto:\s*R\$\s*([\d,\.]+)/);

    if (!saleFeeMatch || !brutoMatch) {
      console.log(`  skip ${b.id} (sem saleFee ou bruto nas notes)`);
      skipped++;
      continue;
    }

    const saleFee = parseFloat(saleFeeMatch[1].replace(',', '.'));
    const envio = envioMatch ? parseFloat(envioMatch[1].replace(',', '.')) : 0;
    const bruto = parseFloat(brutoMatch[1].replace(',', '.'));

    if (!Number.isFinite(saleFee) || !Number.isFinite(bruto) || !Number.isFinite(envio)) {
      console.log(`  skip ${b.id} (número inválido)`);
      skipped++;
      continue;
    }

    const newAmount = bruto - envio;

    const newVendasLine = `VENDAS\nBruto: R$ ${bruto.toFixed(2)} | Taxas: Taxa de envio: R$ ${envio.toFixed(
      2
    )} (Total: R$ ${envio.toFixed(2)}) | Líquido: R$ ${newAmount.toFixed(2)}`;

    const newNotes = b.notes.replace(/VENDAS\n[^\n]*/, newVendasLine);

    await prisma.bill.update({
      where: { id: b.id },
      data: { amount: newAmount, notes: newNotes },
    });

    console.log(
      `  ok ${b.id} | amount ${b.amount.toFixed(2)} → ${newAmount.toFixed(2)} (saleFee ${saleFee.toFixed(2)})`
    );
    updated++;
  }

  console.log(`\n✅ Migração concluída: ${updated} atualizadas, ${skipped} puladas`);
  await prisma.$disconnect();
})();
