#!/usr/bin/env node
/**
 * Remover produtos Samsung que não devem estar no sistema
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const samsungIds = ['MLB6444044090', 'MLB6444164750'];
    
    console.log('🗑️  Removendo produtos Samsung que não devem estar no sistema\n');

    for (const mlId of samsungIds) {
      const produto = await prisma.product.findFirst({
        where: { mlListingId: mlId }
      });

      if (produto) {
        console.log(`🔄 ${mlId} - ${produto.name}`);
        
        // Deletar variações primeiro (por constraints)
        await prisma.productVariant.deleteMany({
          where: { productId: produto.id }
        });
        
        // Depois deletar o produto
        await prisma.product.delete({
          where: { id: produto.id }
        });
        
        console.log(`   ✅ DELETADO\n`);
      } else {
        console.log(`   ⚠️  Não encontrado no banco\n`);
      }
    }

    // Resumo final
    const total = await prisma.product.count();
    const ativos = await prisma.product.count({ where: { active: true } });
    const inativos = await prisma.product.count({ where: { active: false } });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 NOVO STATUS:');
    console.log(`   Total: ${total}`);
    console.log(`   Ativos: ${ativos}`);
    console.log(`   Inativos: ${inativos}`);
    console.log(`\n✅ Banco sincronizado!\n`);

    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
