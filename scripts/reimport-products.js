#!/usr/bin/env node

/**
 * Script para re-importar produtos do ML com variações corretas
 * Deleta os 14 produtos sem variações e re-importa do ML
 */

const BASE_URL = "http://localhost:3000";

const MLListingsWithoutVariations = [
  "MLB6464525836", // Cinza iPhone 16 Pro Max
  "MLB6464525818", // Preto iPhone 12 Pro Max
  "MLB6464525842", // Preto iPhone 16 Pro Max
  "MLB6464525840", // Preto iPhone 15 Pro
  "MLB6464525820", // Rosa iPhone 15 Pro Max
  "MLB6464525816", // Rosa iPhone 12 Pro Max
  "MLB6464525834", // Cinza iPhone 15 Pro
  "MLB6464525838", // Marrom-claro iPhone 15 Pro
  "MLB6464525830", // Roxo iPhone 14 Pro Max
  "MLB6464525822", // Rosa iPhone 16 Pro Max
  "MLB6464525828", // Marrom-claro iPhone 14 Pro Max
  "MLB6464525824", // Preto iPhone 15 Pro Max
  "MLB6464525832", // Preto iPhone 17 Pro Max
  "MLB6464525804", // Película Muda Aparência Prateado
];

async function main() {
  try {
    console.log("🚀 Iniciando re-importação de produtos...\n");

    // 1️⃣ Buscar IDs dos produtos a deletar
    console.log("📋 Passo 1: Buscando produtos a deletar...");
    const productsResponse = await fetch(`${BASE_URL}/api/products?limit=100`);
    const productsData = await productsResponse.json();

    if (!productsData.success) {
      console.error("❌ Erro ao buscar produtos:", productsData);
      process.exit(1);
    }

    const productsToDelete = productsData.data.filter((p) =>
      MLListingsWithoutVariations.includes(p.mlListingId)
    );

    console.log(`✅ Encontrados ${productsToDelete.length} produtos para deletar`);
    console.log(`   ${productsToDelete.map((p) => p.name).join("\n   ")}\n`);

    // 2️⃣ Deletar produtos
    console.log("🗑️  Passo 2: Deletando produtos sem variações...");
    for (const product of productsToDelete) {
      const deleteResponse = await fetch(`${BASE_URL}/api/products/${product.id}`, {
        method: "DELETE",
      });
      const deleteData = await deleteResponse.json();
      console.log(`   ✓ ${product.name.substring(0, 50)}...`);
    }
    console.log(`✅ ${productsToDelete.length} produtos deletados\n`);

    // 3️⃣ Listar produtos do ML
    console.log("📡 Passo 3: Buscando produtos do ML com variações...");
    const mlResponse = await fetch(`${BASE_URL}/api/ml/lista-reais?limit=100`);
    const mlData = await mlResponse.json();

    if (mlData.erro) {
      console.error(`\n❌ Erro ao buscar do ML: ${mlData.erro}`);
      console.error(`   Detalhes: ${mlData.mensagem}`);
      console.error(
        "\n💡 Você precisa estar autenticado. Faça login em: GET /api/ml/oauth/login"
      );
      process.exit(1);
    }

    console.log(`✅ ${mlData.produtos.length} produtos encontrados no ML`);
    console.log(`   - Com variações: ${mlData.resumo.com_variações}`);
    console.log(`   - Sem variações: ${mlData.resumo.sem_variações}\n`);

    // 4️⃣ Filtrar apenas os que estavam sem variações
    const produtosParaReimportar = mlData.produtos.filter((p) =>
      MLListingsWithoutVariations.includes(p.id)
    );

    console.log(`📦 Passo 4: Re-importando ${produtosParaReimportar.length} produtos...`);
    
    if (produtosParaReimportar.length === 0) {
      console.log("⚠️  Nenhum produto encontrado para re-importar");
      console.log("   Todos os produtos podem não estar sincronizados no ML");
      process.exit(0);
    }

    const importResponse = await fetch(`${BASE_URL}/api/ml/import-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produtos: produtosParaReimportar }),
    });

    const importData = await importResponse.json();

    console.log(`✅ Importação concluída!`);
    console.log(`   - Sucesso: ${importData.sucesso}`);
    console.log(`   - Erros: ${importData.erro}`);
    console.log(`   - Total de variações: ${importData.total_variantes}`);
    console.log(`   - Estoque total: ${importData.total_estoque}\n`);

    // 5️⃣ Resumo final
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✨ Re-importação concluída com sucesso!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // 6️⃣ Verificar novo total
    console.log("📊 Passo 5: Verificando novo total de produtos...");
    const finalResponse = await fetch(`${BASE_URL}/api/products?limit=100`);
    const finalData = await finalResponse.json();
    console.log(`✅ Total de produtos agora: ${finalData.pagination.total}`);
    console.log(`   - Ativos: ${finalData.data.filter((p) => p.active).length}`);
    console.log(`   - Inativos: ${finalData.data.filter((p) => !p.active).length}\n`);

  } catch (error) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }
}

main();
