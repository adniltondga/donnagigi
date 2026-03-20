#!/usr/bin/env node
/**
 * Marcar produtos inativos no sistema
 * Sincroniza com o status do Mercado Livre
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const inativosML = ['MLB4518332721', 'MLB6429113696'];
    
    console.log('📦 Marcando produtos como INATIVOS\n');
    console.log('IDs:', inativosML.join(', '), '\n');

    for (const mlId of inativosML) {
      // Encontrar produto
      const produto = await prisma.product.findFirst({
        where: { mlListingId: mlId }
      });

      if (produto) {
        console.log(`🔄 ${mlId}`);
        console.log(`   Nome: ${produto.name}`);
        
        // Marcar como inativo
        await prisma.product.update({
          where: { id: produto.id },
          data: { active: false }
        });
        
        // Marcar variações como inativas também
        await prisma.productVariant.updateMany({
          where: { productId: produto.id },
          data: { active: false }
        });
        
        console.log(`   ✅ Marcado como INATIVO\n`);
      } else {
        console.log(`❌ ${mlId} - Produto não encontrado\n`);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Resumo
    const ativos = await prisma.product.count({ where: { active: true } });
    const inativos = await prisma.product.count({ where: { active: false } });
    const total = await prisma.product.count();

    console.log('📊 NOVO RESUMO:');
    console.log(`   Total: ${total}`);
    console.log(`   Ativos: ${ativos}`);
    console.log(`   Inativos: ${inativos}`);
    console.log(`\n✅ Sincronizado com ML!\n`);

    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
