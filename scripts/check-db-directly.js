#!/usr/bin/env node

/**
 * Script para verificar diretamente no banco de dados
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("🔍 Verificando banco de dados...\n");

    // Contar produtos
    const totalProducts = await prisma.product.count();
    const activeProducts = await prisma.product.count({ where: { active: true } });
    const inactiveProducts = await prisma.product.count({ where: { active: false } });

    console.log("📊 TOTAL DE PRODUTOS:");
    console.log(`   Total: ${totalProducts}`);
    console.log(`   Ativos: ${activeProducts}`);
    console.log(`   Inativos: ${inactiveProducts}\n`);

    // Verificar variações
    const productsWithoutVariants = await prisma.product.findMany({
      where: {
        variants: { none: {} }
      },
      select: {
        id: true,
        name: true,
        mlListingId: true,
        active: true
      }
    });

    console.log("📦 PRODUTOS SEM VARIAÇÕES:");
    if (productsWithoutVariants.length === 0) {
      console.log(`   ✅ Nenhum produto sem variações! Perfeito!\n`);
    } else {
      console.log(`   ⚠️  ${productsWithoutVariants.length} produtos sem variações:`);
      productsWithoutVariants.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name.substring(0, 50)}... (${p.mlListingId})`);
      });
      console.log("");
    }

    // Total de variações
    const totalVariants = await prisma.productVariant.count();
    console.log(`📈 TOTAL DE VARIAÇÕES: ${totalVariants}\n`);

    // Resumo de sincronização
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✨ RESUMO DA SINCRONIZAÇÃO");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if (productsWithoutVariants.length === 0 && activeProducts > 10) {
      console.log("✅ Banco de dados sincronizado corretamente!");
      console.log(`   - ${activeProducts} produtos ativos com variações`);
      console.log(`   - ${totalVariants} variações no total`);
      console.log(`   - 0 produtos órfãos (sem variações)`);
      console.log("\n🎉 Sua base está pronta para gerenciar no admin panel!");
    } else {
      console.log("⚠️  Ainda há itens a sincronizar");
      console.log(`   - ${productsWithoutVariants.length} produtos sem variações`);
      console.log(`   - ${activeProducts} produtos ativos`);
      console.log(`   - ${totalVariants} variações`);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }
}

main();
