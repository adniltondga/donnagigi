const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteBills() {
  try {
    console.log('🗑️ Deletando todos os bills...\n');
    
    const deleted = await prisma.bill.deleteMany();
    
    console.log(`✅ ${deleted.count} bills deletados com sucesso!\n`);
  } catch (error) {
    console.error('❌ Erro ao deletar bills:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteBills();
