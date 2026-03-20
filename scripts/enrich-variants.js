#!/usr/bin/env node

/**
 * Script para enriquecer produtos com detalhes corretos do ML
 * Busca as variações de cada produto individual usando GET /items/{id}
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const accessToken = 'APP_USR-1656045364090057-031922-2c9cdd4cb901d61f991ccf12e3131c71-267571726';

async function main() {
  try {
    console.log('🔍 ENRIQUECENDO PRODUTOS COM VARIAÇÕES\n');

    // Buscar todos os produtos
    const produtos = await prisma.product.findMany({
      include: { variants: true }
    });

    console.log(`📋 Total de produtos: ${produtos.length}`);
    console.log(`📦 Produtos com 0 variações: ${produtos.filter(p => p.variants.length === 0).length}\n`);

    // Para cada produto, buscar detalhes completos
    for (const produto of produtos) {
      console.log(`\n🔄 Processando: ${produto.name}`);
      console.log(`   ID: ${produto.mlListingId}`);
      console.log(`   Variações atual: ${produto.variants.length}`);

      try {
        // Buscar detalhes completos do produto
        const detailRes = await fetch(
          `https://api.mercadolibre.com/items/${produto.mlListingId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!detailRes.ok) {
          console.log(`   ⚠️ Erro ao buscar detalhes: ${detailRes.status}`);
          continue;
        }

        const detail = await detailRes.json();

        // Se não há variações, criar uma padrão
        if (!detail.variations || detail.variations.length === 0) {
          console.log(`   ℹ️ Nenhuma variação encontrada - criando padrão`);

          // Deletar variações existentes
          await prisma.productVariant.deleteMany({
            where: { productId: produto.id }
          });

          // Criar variação padrão
          await prisma.productVariant.create({
            data: {
              productId: produto.id,
              cod: produto.mlListingId,
              title: detail.title,
              salePrice: detail.price,
              stock: detail.available_quantity || 0,
              mlListingId: detail.id,
              active: true
            }
          });

          console.log(`   ✅ Variação padrão criada`);
          continue;
        }

        // Se tem variações, buscar e criar
        console.log(`   📊 Encontradas ${detail.variations.length} variações`);

        // Deletar variações antigas
        await prisma.productVariant.deleteMany({
          where: { productId: produto.id }
        });

        // Criar novas variações
        for (const variation of detail.variations) {
          const atributos = variation.attribute_combinations
            ?.map(attr => attr.value)
            .join(" - ") || "";

          const variantTitle = atributos
            ? `${detail.title} - ${atributos}`
            : detail.title;

          const cod = variation.user_product_id || 
                     variation.seller_sku || 
                     `ML_${detail.id}_${variation.id}`;

          await prisma.productVariant.create({
            data: {
              productId: produto.id,
              cod: cod,
              title: variantTitle,
              salePrice: variation.price || detail.price,
              stock: variation.available_quantity || 0,
              mlListingId: `${detail.id}_${variation.id}`,
              active: true
            }
          });
        }

        console.log(`   ✅ ${detail.variations.length} variações criadas`);

      } catch (error) {
        console.error(`   ❌ Erro: ${error.message}`);
      }
    }

    // Resumo final
    console.log('\n\n📊 RESUMO FINAL:');
    const produtosAtualizados = await prisma.product.findMany({
      include: { variants: true }
    });

    const comVariacoes = produtosAtualizados.filter(p => p.variants.length > 0);
    const semVariacoes = produtosAtualizados.filter(p => p.variants.length === 0);
    const totalVariacoes = produtosAtualizados.reduce((sum, p) => sum + p.variants.length, 0);

    console.log(`  • Total produtos: ${produtosAtualizados.length}`);
    console.log(`  • Com variações: ${comVariacoes.length}`);
    console.log(`  • Sem variações: ${semVariacoes.length}`);
    console.log(`  • Total variações: ${totalVariacoes}`);

    console.log('\n✨ Enriquecimento concluído!');

  } catch (error) {
    console.error('❌ Erro fatal:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
