const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const token = await prisma.mLIntegration.findFirst();
  
  if (token) {
    console.log('✅ Token encontrado:');
    console.log('  Vendedor:', token.sellerID);
    console.log('  Token:', token.accessToken.substring(0, 50) + '...');
    console.log('  Expira:', token.expiresAt);
    console.log('');
    
    // Teste 1: /users/me
    console.log('🧪 Testando /users/me...');
    const meRes = await fetch('https://api.mercadolibre.com/users/me', {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('  Status:', meRes.status);
    if (meRes.ok) {
      const meData = await meRes.json();
      console.log('  ✅ User:', meData.nickname);
    } else {
      console.log('  ❌ Erro:', await meRes.text());
    }
    
    console.log('');
    
    // Teste 2: /users/{id}/listings
    console.log('🧪 Testando /users/{id}/listings...');
    const listRes = await fetch(`https://api.mercadolibre.com/users/${token.sellerID}/listings?offset=0&limit=5`, {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('  Status:', listRes.status);
    if (listRes.ok) {
      const listings = await listRes.json();
      console.log('  ✅ Produtos encontrados:', listings.length);
      if (listings.length > 0) {
        console.log('  Primeiro:', listings[0].id, '-', listings[0].title);
      }
    } else {
      const errorText = await listRes.text();
      console.log('  ❌ Erro:', errorText.substring(0, 300));
    }
  } else {
    console.log('❌ Token não encontrado no banco');
  }
  
  await prisma.$disconnect();
})();
