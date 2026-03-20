#!/usr/bin/env node

/**
 * Script para analisar os dados reais do ML
 * Verifica quais produtos/variações estão no ML e qual é a estrutura deles
 */

const BASE_URL = "http://localhost:3000";

async function main() {
  try {
    console.log("🔍 Analisando estrutura dos dados do ML...\n");

    // Buscar um produto com variações do sistema atual
    const productsResponse = await fetch(`${BASE_URL}/api/products?limit=100`);
    const productsData = await productsResponse.json();
    const firstProductWithVariants = productsData.data?.find(
      (p) => p.variants && p.variants.length > 0
    );

    if (!firstProductWithVariants) {
      console.log("❌ Nenhum produto com variações encontrado");
      process.exit(1);
    }

    console.log("📦 PRIMEIRO PRODUTO COM VARIAÇÕES:");
    console.log(`   Nome: ${firstProductWithVariants.name}`);
    console.log(`   MLB: ${firstProductWithVariants.mlListingId}`);
    console.log(`   Variações: ${firstProductWithVariants.variants.length}\n`);

    console.log("📋 AMOSTRA DAS VARIAÇÕES SALVAS NO SISTEMA:");
    firstProductWithVariants.variants.slice(0, 2).forEach((v, i) => {
      console.log(`   ${i + 1}. COD: ${v.cod}`);
      console.log(`      Mercado Livre ID: ${v.mlListingId}`);
      console.log(`      Estoque: ${v.stock}`);
      console.log(`      Preço: ${v.salePrice}\n`);
    });

    // Agora vamos contar quantos produtos faltam sincronizar
    const totalProducts = productsData.pagination.total;
    const productsWithVariants = productsData.data.filter(
      (p) => p.variants && p.variants.length > 0
    ).length;

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 ANÁLISE DE SINCRONIZAÇÃO:");
    console.log(`   Total de produtos: ${totalProducts}`);
    console.log(`   Com variações: ${productsWithVariants}`);
    console.log(`   Faltando: ${24 - productsWithVariants} (ML tem ~24 ativos)\n`);

    console.log("💡 EXPLICAÇÃO:");
    console.log("   Os códigos salvos (ex: ML_{id}_{varId}) são GENÉRICOS");
    console.log("   Deveriam ser os SKU REAIS do ML (ex: 7202052544954333)");
    console.log("   Sem os SKU corretos, não conseguimos sincronizar com ML.\n");

    console.log("✅ PRÓXIMO PASSO:");
    console.log("   Para re-importar com SKU corretos, você precisa:");
    console.log("   1. Listar os produtos do ML com GET /api/ml/lista-reais");
    console.log("   2. Extrair os seller_sku de cada variação");
    console.log("   3. Re-importar com POST /api/ml/import-batch");
    console.log("\n   Comando para listar do ML:");
    console.log("   curl -s http://localhost:3000/api/ml/lista-reais?limit=100");

  } catch (error) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }
}

main();
