#!/usr/bin/env node

/**
 * Script para inspecionar TODA a estrutura de dados que vem do ML
 * Mostra todos os campos disponíveis em um produto com variações
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("🔍 Buscando integration com token do ML...\n");

    const mlIntegration = await prisma.mLIntegration.findFirst();

    if (!mlIntegration) {
      console.error("❌ Não há integração com ML configurada");
      process.exit(1);
    }

    // Buscar um produto do sistema para usar seu MLB
    const produto = await prisma.product.findFirst({
      where: { mlListingId: { not: null } }
    });

    if (!produto) {
      console.error("❌ Nenhum produto com MLB encontrado");
      process.exit(1);
    }

    console.log(`📦 Buscando detalhes do produto: ${produto.mlListingId}\n`);

    // Chamar API do ML
    const url = `https://api.mercadolibre.com/items/${produto.mlListingId}`;
    console.log(`📡 URL chamada: ${url}\n`);

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${mlIntegration.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      console.error(`❌ Erro da API: ${response.status}`);
      console.error(await response.text());
      process.exit(1);
    }

    const mlData = await response.json();

    console.log("✅ ESTRUTURA COMPLETA RETORNADA PELA API DO ML:\n");
    console.log(JSON.stringify(mlData, null, 2));

    console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 PRINCIPAIS CAMPOS DISPONÍVEIS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const campos = {
      "ID do anúncio": mlData.id,
      "Título": mlData.title,
      "Preço": mlData.price,
      "Estoque disponível": mlData.available_quantity,
      "Descrição": mlData.description ? "SIM (existe)" : "NÃO",
      "Total de variações": mlData.variations?.length || 0,
      "Categoria": mlData.category_id,
      "Status do anúncio": mlData.status,
      "Data de criação": mlData.date_created,
      "Seller ID": mlData.seller_id,
      "Atributos": mlData.attributes?.length || 0
    };

    Object.entries(campos).forEach(([chave, valor]) => {
      console.log(`   ${chave}: ${valor}`);
    });

    if (mlData.variations && mlData.variations.length > 0) {
      console.log("\n📦 ESTRUTURA DA PRIMEIRA VARIAÇÃO:");
      console.log(JSON.stringify(mlData.variations[0], null, 2));

      console.log("\n💡 CAMPOS IMPORTANTES NA VARIAÇÃO:");
      const var1 = mlData.variations[0];
      const varCampos = {
        "ID da variação": var1.id,
        "SKU do vendedor": var1.seller_sku || "NÃO DEFINIDO",
        "Preço": var1.price,
        "Quantidade": var1.quantity,
        "Atributos": var1.attribute_combinations?.map(a => `${a.name}:${a.value}`).join(", ") || "NENHUM"
      };

      Object.entries(varCampos).forEach(([chave, valor]) => {
        console.log(`   ${chave}: ${valor}`);
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }
}

main();
