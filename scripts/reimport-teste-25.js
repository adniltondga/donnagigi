#!/usr/bin/env node

/**
 * Script para importar os 25 produtos de teste com os códigos corretos
 */

const BASE_URL = 'http://localhost:3000';

async function main() {
  try {
    console.log('🔄 RE-IMPORTAÇÃO COM CÓDIGOS CORRETOS\n');

    // PASSO 1: Buscar dados de teste
    console.log('📥 Passo 1: Buscando 25 produtos de teste...');
    const testRes = await fetch(`${BASE_URL}/api/ml/test-products-25`);
    const testData = await testRes.json();
    const produtos = testData.produtos || testData.data || [];
    
    if (produtos.length === 0) {
      console.log('⚠️ Nenhum produto encontrado nos dados de teste');
      
      // Tenta fazer uma chamada direta para ver a estrutura
      const directRes = await fetch(`${BASE_URL}/api/ml/test-products-25`);
      const response = await directRes.text();
      console.log('\nResposta bruta:', response.substring(0, 500));
      return;
    }
    
    console.log(`✅ ${produtos.length} produtos de teste encontrados\n`);

    // PASSO 2: Verificar estrutura
    console.log('📋 AMOSTRA DO PRIMEIRO PRODUTO:');
    console.log(`   Título: ${produtos[0].title}`);
    console.log(`   Variações: ${produtos[0].variations?.length || 0}`);
    if (produtos[0].variations?.length > 0) {
      console.log(`   Primeira variação SKU: ${produtos[0].variations[0].seller_sku || 'N/A'}`);
    }
    console.log();

    // PASSO 3: Importar
    console.log('🚀 Passo 2: Importando todos os produtos...');
    const importRes = await fetch(`${BASE_URL}/api/ml/import-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produtos })
    });

    if (!importRes.ok) {
      const error = await importRes.json();
      console.error('❌ Erro na importação:', error);
      return;
    }

    const importData = await importRes.json();
    console.log(`✅ Importação concluída!\n`);

    console.log('📊 RESUMO:');
    console.log(`  • Produtos importados: ${importData.totalImportados || 0}`);
    console.log(`  • Total de variações: ${importData.totalVariacoes || 0}`);
    console.log(`  • Produto com mais variações: ${importData.maxVariacoes || 0}`);

    if (importData.primeiros_5_resultados) {
      console.log('\n📦 PRIMEIROS 3 PRODUTOS IMPORTADOS:');
      importData.primeiros_5_resultados.slice(0, 3).forEach((prod, idx) => {
        console.log(`\n  ${idx + 1}. ${prod.name}`);
        console.log(`     Variações: ${prod.variants.length}`);
        if (prod.variants.length > 0) {
          prod.variants.slice(0, 2).forEach((v) => {
            console.log(`       - COD: ${v.cod} | ${v.title || 'sem título'}`);
          });
        }
      });
    }

    console.log('\n✨ VERIFICA EM: http://localhost:3000/admin/products');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
