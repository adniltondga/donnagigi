#!/usr/bin/env node

/**
 * Script simples para verificar status da re-importação
 */

const BASE_URL = "http://localhost:3000";

async function main() {
  try {
    console.log("📊 Verificando status dos produtos...\n");

    // Buscar todos os produtos
    const response = await fetch(`${BASE_URL}/api/products?limit=100`);
    const data = await response.json();

    if (!data.success) {
      console.error("❌ Erro ao buscar produtos:", data);
      process.exit(1);
    }

    const produtos = data.data || [];
    const total = data.pagination?.total || 0;
    const ativos = produtos.filter(p => p.active).length;
    const inativos = produtos.filter(p => !p.active).length;
    const comVariacoes = produtos.filter(p => p.variants && p.variants.length > 0).length;
    const semVariacoes = produtos.filter(p => !p.variants || p.variants.length === 0).length;

    console.log("📈 ESTATÍSTICAS GERAIS:");
    console.log(`   Total de produtos: ${total}`);
    console.log(`   Ativos: ${ativos}`);
    console.log(`   Inativos: ${inativos}`);
    console.log("");
    
    console.log("📦 VARIAÇÕES:");
    console.log(`   Com variações: ${comVariacoes}`);
    console.log(`   Sem variações: ${semVariacoes}`);
    console.log("");

    if (semVariacoes === 0) {
      console.log("✅ PERFEITO! Todos os ${total} produtos têm variações!");
      console.log("   Sua base está sincronizada corretamente com o ML.");
    } else {
      console.log(`⚠️  Ainda existem ${semVariacoes} produtos sem variações:`);
      produtos
        .filter(p => !p.variants || p.variants.length === 0)
        .forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.name.substring(0, 60)} (${p.mlListingId})`);
        });
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Comparação com ML
    console.log("\n📊 COMPARAÇÃO COM MERCADO LIVRE:");
    console.log(`   Sistema (ativos): ${ativos}`);
    console.log(`   ML reporta: 24 anúncios ativos`);
    
    if (ativos >= 24) {
      console.log(`   ✅ Sincronizado!`);
    } else {
      console.log(`   ⚠️  Diferença de ${24 - ativos} produtos`);
    }

  } catch (error) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }
}

main();
