#!/usr/bin/env node
/**
 * Encontrar o produto que está no ML mas NÃO no banco
 * ML tem 26 (24 ativos + 2 inativos)
 * Banco tem 25
 * Logo, há 1 produto a MAIS no ML
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // IDs que estão no banco (25 produtos)
    const idsNoBanco = [
      "MLB4521375763", "MLB4521466245", "MLB6437562448", "MLB4520767473",
      "MLB4520911065", "MLB6464525830", "MLB6464525818", "MLB6464525832",
      "MLB6464525820", "MLB6464525836", "MLB4518332721", "MLB6464525834",
      "MLB6464525822", "MLB4518503825", "MLB6464525842", "MLB6464525828",
      "MLB6464525840", "MLB6438887668", "MLB6433382978", "MLB6464525804",
      "MLB6464525816", "MLB4518221581", "MLB6464525838", "MLB6464525824",
      "MLB6429113696"
    ];

    console.log('🔍 Procurando produto extra no ML\n');
    console.log(`📦 Banco tem: ${idsNoBanco.length} produtos`);
    
    // Pegar token
    const ml = await prisma.mLIntegration.findFirst();
    if (!ml?.token) throw new Error('Sem token');

    // Pegar user ID
    const meRes = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { 'Authorization': `Bearer ${ml.token}` }
    });
    const me = await meRes.json();

    // Buscar listings (incluindo inativos)
    const listRes = await fetch(
      `https://api.mercadolibre.com/users/${me.id}/listings?offset=0&limit=200`,
      { headers: { 'Authorization': `Bearer ${ml.token}` } }
    );
    const idsNoML = await listRes.json();

    console.log(`📦 ML tem: ${idsNoML.length} produtos (24 ativos + 2 inativos)\n`);

    // Encontrar o produto extra no ML
    const extra = idsNoML.filter(id => !idsNoBanco.includes(id));

    if (extra.length > 0) {
      console.log('❓ PRODUTO NO ML MAS NÃO NO BANCO:\n');
      for (const id of extra) {
        console.log(`   ID: ${id}`);
        
        // Buscar detalhes desse produto
        try {
          const detRes = await fetch(
            `https://api.mercadolibre.com/items/${id}`,
            { headers: { 'Authorization': `Bearer ${ml.token}` } }
          );
          const det = await detRes.json();
          console.log(`   Nome: ${det.title || det.name || 'N/A'}`);
          console.log(`   Status: ${det.status || 'N/A'}`);
          console.log(`   Ativo: ${det.stop_time ? 'NÃO - Finalizado' : 'SIM'}\n`);
        } catch (e) {
          console.log(`   ⚠️  Erro ao buscar detalhes: ${e.message}\n`);
        }
      }
    } else {
      console.log('✅ Nenhum produto extra encontrado');
    }

    await prisma.$disconnect();
  } catch (e) {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  }
}

main();
