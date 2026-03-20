#!/usr/bin/env node
/**
 * Comparar IDs do banco com IDs do ML
 * Descobre qual produto foi deletado/inativado
 */

process.chdir('/Users/2480dtidigital/site/donnagigi');

const idsNoBanco = [
  "MLB4521375763", "MLB4521466245", "MLB6437562448", "MLB4520767473",
  "MLB4520911065", "MLB6464525830", "MLB6464525818", "MLB6464525832",
  "MLB6464525820", "MLB6464525836", "MLB4518332721", "MLB6464525834",
  "MLB6464525822", "MLB4518503825", "MLB6464525842", "MLB6464525828",
  "MLB6464525840", "MLB6438887668", "MLB6433382978", "MLB6464525804",
  "MLB6464525816", "MLB4518221581", "MLB6464525838", "MLB6464525824",
  "MLB6429113696"
];

console.log(`📦 Carregando dados do banco: ${idsNoBanco.length} produtos\n`);

async function main() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Pegar token
    const ml = await prisma.mLIntegration.findFirst();
    if (!ml?.token) throw new Error('Sem token');

    console.log('🔍 Buscando lista do ML...\n');

    // Pegar user ID
    const meRes = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { 'Authorization': `Bearer ${ml.token}` }
    });
    const me = await meRes.json();

    // Buscar listings
    const listRes = await fetch(
      `https://api.mercadolibre.com/users/${me.id}/listings?offset=0&limit=200`,
      { headers: { 'Authorization': `Bearer ${ml.token}` } }
    );
    const idsNoML = await listRes.json();

    console.log(`📦 Mercado Livre reporta: ${idsNoML.length} produtos ativos\n`);

    // Comparar
    const faltam = idsNoBanco.filter(id => !idsNoML.includes(id));
    const novos = idsNoML.filter(id => !idsNoBanco.includes(id));

    if (faltam.length > 0) {
      console.log('❌ NO BANCO MAS NÃO NO ML (DELETADO/INATIVADO):');
      for (const id of faltam) {
        const prod = await prisma.product.findFirst({ where: { mlListingId: id } });
        console.log(`   ${id}`);
        console.log(`   Nome: ${prod?.name}\n`);
      }
    }

    if (novos.length > 0) {
      console.log('\n❓ NO ML MAS NÃO NO BANCO:');
      novos.forEach(id => console.log(`   ${id}`));
    }

    if (faltam.length === 0 && novos.length === 0) {
      console.log('✅ Tudo sincronizado!');
    }

    await prisma.$disconnect();
  } catch (e) {
    console.error('❌ Erro:', e.message);
  }
}

main();
