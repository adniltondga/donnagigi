const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const integration = await prisma.mLIntegration.findFirst();
    if (!integration?.token) {
      console.log('❌ Sem token');
      process.exit(1);
    }

    console.log('🔍 VERIFICANDO PRODUTOS ATIVOS NO ML\n');

    // Listar produtos
    const meResp = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { 'Authorization': `Bearer ${integration.token}` }
    });
    const meData = await meResp.json();
    const userId = meData.id;

    // Buscar listings
    const listResp = await fetch(`https://api.mercadolibre.com/users/${userId}/listings?offset=0&limit=200`, {
      headers: { 'Authorization': `Bearer ${integration.token}` }
    });
    const listings = await listResp.json();

    console.log(`📦 Produtos ATIVOS no ML: ${listings.length}`);
    console.log('\n📋 IDs do ML:');
    listings.forEach((id, i) => {
      console.log(`  ${i + 1}. ${id}`);
    });

    // Comparar com banco
    console.log('\n\n🔎 BUSCANDO DIFERENÇAS:\n');
    const bancoIds = (await prisma.product.findMany({ select: { mlListingId: true, name: true } })).map(p => ({
      id: p.mlListingId,
      name: p.name
    }));
    const mlIds = listings;

    const emBancoMasNaoML = bancoIds.filter(p => !mlIds.includes(p.id));
    const emMLMasNaoBanco = mlIds.filter(id => !bancoIds.map(p => p.id).includes(id));

    if (emBancoMasNaoML.length > 0) {
      console.log('❌ NO BANCO MAS NÃO NO ML (INATIVO/DELETADO):');
      emBancoMasNaoML.forEach(p => console.log(`  - ${p.id} (${p.name.substring(0, 50)})`));
    }

    if (emMLMasNaoBanco.length > 0) {
      console.log('\n❓ NO ML MAS NÃO NO BANCO:');
      emMLMasNaoBanco.forEach(id => console.log(`  - ${id}`));
    }

    if (emBancoMasNaoML.length === 0 && emMLMasNaoBanco.length === 0) {
      console.log('✅ Todos os produtos estão sincronizados!');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
})();
