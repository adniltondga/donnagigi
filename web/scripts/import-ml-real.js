#!/usr/bin/env node

/**
 * Script para importar dados REAIS do Mercado Livre
 * Busca o token no banco de dados e usa para autenticar
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3000';

async function main() {
  try {
    console.log('🔍 IMPORTAÇÃO DOS DADOS REAIS DO MERCADO LIVRE\n');

    // PASSO 1: Buscar token do banco
    console.log('📌 Passo 1: Buscando token no banco de dados...');
    const mlIntegration = await prisma.mLIntegration.findFirst();

    if (!mlIntegration) {
      console.log('❌ Token não encontrado no banco');
      console.log('⚠️ Você precisa fazer login primeiro em: http://localhost:3000/api/ml/oauth/login');
      process.exit(1);
    }

    console.log('✅ Token encontrado!');
    console.log(`   Vendedor: ${mlIntegration.sellerID}`);
    console.log(`   Expira em: ${new Date(mlIntegration.expiresAt).toLocaleString('pt-BR')}`);

    // PASSO 2: Validar token
    const now = new Date();
    if (now > mlIntegration.expiresAt) {
      console.log('\n❌ Token expirado!');
      console.log('⚠️ Faça login novamente em: http://localhost:3000/api/ml/oauth/login');
      process.exit(1);
    }

    const hoursLeft = (mlIntegration.expiresAt - now) / (1000 * 60 * 60);
    console.log(`   Válido por: ${Math.round(hoursLeft)} horas\n`);

    // PASSO 3: Chamar API real do ML para listar produtos
    console.log('📥 Passo 2: Buscando seus produtos no Mercado Livre...');
    const mlUrl = `https://api.mercadolibre.com/users/${mlIntegration.sellerID}/listings?offset=0&limit=100`;

    const listRes = await fetch(mlUrl, {
      headers: {
        'Authorization': `Bearer ${mlIntegration.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!listRes.ok) {
      throw new Error(`Erro da API ML: ${listRes.status} ${listRes.statusText}`);
    }

    const listings = await listRes.json();
    console.log(`✅ ${listings.length} produtos encontrados\n`);

    if (listings.length === 0) {
      console.log('⚠️ Você não tem produtos no Mercado Livre ainda');
      process.exit(0);
    }

    // PASSO 4: Buscar detalhes completos (com variações)
    console.log('📋 Passo 3: Buscando detalhes dos produtos...');
    const produtosCompletos = await Promise.all(
      listings.map(async (listing) => {
        try {
          const detailRes = await fetch(
            `https://api.mercadolibre.com/items/${listing.id}`,
            {
              headers: {
                'Authorization': `Bearer ${mlIntegration.accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (!detailRes.ok) {
            return {
              id: listing.id,
              title: listing.title || 'Sem título',
              price: 0,
              available_quantity: 0,
              variations: []
            };
          }

          const detail = await detailRes.json();
          return {
            id: detail.id,
            title: detail.title,
            price: detail.price,
            available_quantity: detail.available_quantity || 0,
            variations: detail.variations || []
          };
        } catch (err) {
          console.error(`  ⚠️ Erro ao buscar ${listing.id}:`, err.message);
          return null;
        }
      })
    );

    const validProducts = produtosCompletos.filter(p => p !== null);
    console.log(`✅ ${validProducts.length} produtos com detalhes\n`);

    // PASSO 5: Importar no sistema
    console.log('🚀 Passo 4: Importando para o sistema...');
    const importRes = await fetch(`${BASE_URL}/api/ml/import-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produtos: validProducts })
    });

    const importData = await importRes.json();

    console.log('\n✅ Importação concluída!');
    console.log(`  • Processados: ${importData.resumo.total_processado}`);
    console.log(`  • Importados: ${importData.resumo.total_importado}`);
    console.log(`  • Variações: ${importData.resumo.total_variantes}`);
    console.log(`  • Estoque total: ${importData.resumo.total_estoque}`);
    console.log(`  • Taxa sucesso: ${importData.resumo.taxa_sucesso}`);

    if (importData.detalhes?.length > 0) {
      console.log('\n📦 PRIMEIROS 3 PRODUTOS IMPORTADOS:');
      importData.detalhes.slice(0, 3).forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.titulo}`);
        console.log(`     Status: ${item.status}`);
      });
    }

    console.log('\n✨ Acesse: http://localhost:3000/admin/products');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
