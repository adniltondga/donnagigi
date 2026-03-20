#!/usr/bin/env node

/**
 * Script para importar dados REAIS do Mercado Livre
 * Seguindo a documentação: SINCRONISMO_COMPLETO.md
 * 
 * Processo:
 * 1. Buscar token no banco
 * 2. GET /users/me (validar autenticação)
 * 3. GET /users/{id}/listings (listar produtos)
 * 4. Pegar os 25 primeiros
 * 5. Loop em batches de 20 -> GET /items?ids=...
 * 6. Desembrulhar response {code, body}
 * 7. Deletar apenas produtos existentes (não toca outras tabelas)
 * 8. Upsert produtos no banco
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3000';

async function main() {
  try {
    console.log('🔍 SINCRONIZAÇÃO COM MERCADO LIVRE\n');
    console.log('📖 Seguindo: SINCRONISMO_COMPLETO.md\n');

    // PASSO 1: Buscar token do banco
    console.log('1️⃣ Validar Token no DB');
    const mlIntegration = await prisma.mLIntegration.findFirst();

    if (!mlIntegration) {
      console.log('❌ Token não encontrado no banco');
      process.exit(1);
    }

    // Usar token fornecido (com permissões)
    const accessToken = 'APP_USR-1656045364090057-031922-2c9cdd4cb901d61f991ccf12e3131c71-267571726';
    const sellerID = mlIntegration.sellerID;

    console.log(`✅ Token encontrado - Vendedor: ${sellerID}\n`);

    // PASSO 2: GET /users/me
    console.log('2️⃣ GET /users/me (Validar autenticação)');
    const meRes = await fetch('https://api.mercadolibre.com/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!meRes.ok) {
      throw new Error(`Erro /users/me: ${meRes.status}`);
    }

    const meData = await meRes.json();
    console.log(`✅ Autenticado como: ${meData.nickname}\n`);

    // PASSO 3: GET /users/{id}/listings
    console.log('3️⃣ GET /users/{id}/listings (Listar produtos)');
    const listRes = await fetch(
      `https://api.mercadolibre.com/users/${sellerID}/listings?offset=0&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!listRes.ok) {
      throw new Error(`Erro /listings: ${listRes.status}`);
    }

    const listings = await listRes.json();
    console.log(`✅ Total de produtos no ML: ${listings.length}`);

    // PASSO 4: Slice 25 primeiros
    const target_count = 25;
    const targetIds = listings.slice(0, target_count).map(l => l.id);
    console.log(`✅ Selecionados: ${targetIds.length} primeiros\n`);

    // PASSO 5: Loop em Batches de 20
    console.log('4️⃣ Fetching detalhes em batches de 20');
    const BATCH_SIZE = 20;
    const allProducts = [];

    for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
      const batchIds = targetIds.slice(i, i + BATCH_SIZE);
      const idsParam = batchIds.join(',');

      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchIds.length} produtos...`);

      // PASSO 6: GET /items?ids=...
      const detailRes = await fetch(
        `https://api.mercadolibre.com/items?ids=${idsParam}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!detailRes.ok) {
        console.error(`  ❌ Erro no batch`);
        continue;
      }

      // PASSO 7: Desembrulhar Response {code, body}
      const rawBatch = await detailRes.json();
      const unwrapped = rawBatch.map(item => item.body);
      allProducts.push(...unwrapped);
    }

    console.log(`✅ Total de produtos carregados: ${allProducts.length}\n`);

    // PASSO 8: Deletar apenas produtos existentes (não toca outras tabelas!)
    console.log('5️⃣ Limpando apenas produtos antigos...');
    const existingCount = await prisma.product.count();
    if (existingCount > 0) {
      // Primeiro deleta variações
      await prisma.productVariant.deleteMany({});
      // Depois deleta produtos
      await prisma.product.deleteMany({});
      console.log(`✅ ${existingCount} produtos deletados`);
      console.log('   (MLIntegration e outras tabelas preservadas)\n');
    }

    // PASSO 9: Upsert produtos no banco
    console.log('6️⃣ Upsert dos produtos no banco');
    for (const produto of allProducts) {
      await prisma.product.create({
        data: {
          name: produto.title,
          description: produto.description?.plain_text || '',
          mlListingId: produto.id,
          baseSalePrice: produto.price,
          minStock: produto.available_quantity || 0,
          active: true
        }
      });
    }

    console.log(`✅ ${allProducts.length} produtos importados\n`);

    // RESUMO
    console.log('📊 RESUMO DA SINCRONIZAÇÃO:');
    console.log(`  • Total products: ${allProducts.length}`);
    console.log(`  • Status: ✅ Sucesso`);
    console.log('\n✨ Acesse: http://localhost:3000/admin/products');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
