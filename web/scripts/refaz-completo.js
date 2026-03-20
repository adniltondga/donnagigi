#!/usr/bin/env node

const BASE_URL = 'http://localhost:3000';

async function main() {
  try {
    console.log('🔄 INICIANDO RE-IMPORTAÇÃO COMPLETA...\n');

    // PASSO 1: Listar todos os produtos
    console.log('📋 Passo 1: Listando 11 produtos atuais...');
    const listRes = await fetch(`${BASE_URL}/api/products?limit=100`);
    const listData = await listRes.json();
    const produtosAtuais = listData.data || [];
    console.log(`✅ Encontrados ${produtosAtuais.length} produtos\n`);

    if (produtosAtuais.length === 0) {
      console.log('⚠️ Nenhum produto para deletar. Prosseguindo para import...\n');
    } else {
      // PASSO 2: Deletar todos
      console.log('🗑️ Passo 2: Deletando todos os produtos...');
      for (const produto of produtosAtuais) {
        const delRes = await fetch(`${BASE_URL}/api/products/${produto.id}`, {
          method: 'DELETE',
        });
        const delData = await delRes.json();
        console.log(`  ✓ ${produto.name}`);
      }
      console.log(`✅ ${produtosAtuais.length} produtos deletados\n`);
    }

    // PASSO 3: Re-importar
    console.log('📥 Passo 3: Re-importando com CÓDIGOS CORRETOS...');
    const importRes = await fetch(`${BASE_URL}/api/ml/import-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 100 }),
    });
    const importData = await importRes.json();

    console.log(`✅ Re-importação concluída!\n`);
    console.log('📊 RESUMO:');
    console.log(`  • Produtos importados: ${importData.totalImportados || 0}`);
    console.log(`  • Total de variações: ${importData.totalVariacoes || 0}`);

    if (importData.primeiros_5_resultados) {
      console.log('\n📦 PRIMEIROS 3 PRODUTOS IMPORTADOS:');
      importData.primeiros_5_resultados.slice(0, 3).forEach((prod, idx) => {
        console.log(`\n  ${idx + 1}. ${prod.name}`);
        console.log(`     Variações: ${prod.variants.length}`);
        if (prod.variants.length > 0) {
          prod.variants.slice(0, 2).forEach((v) => {
            console.log(`       - ${v.cod}: ${v.title || 'sem título'}`);
          });
        }
      });
    }

    console.log('\n✨ TUDO FEITO! Acesse http://localhost:3000/admin/products');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
