#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');

// Diretório do projeto
process.chdir('/Users/2480dtidigital/site/donnagigi');

async function main() {
  console.log('📋 Listando produtos do banco de dados...\n');
  
  const { execSync } = require('child_process');
  
  try {
    // Executar Prisma para pegar dados
    const output = execSync(
      'npx prisma db execute --stdin << \'SQL\'\nSELECT "mlListingId", "name" FROM "Product" ORDER BY id;\nSQL',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    
    const lines = output.trim().split('\n');
    const produtos = [];
    
    lines.forEach(line => {
      if (line && line.includes('|') && !line.includes('mlListingId')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 2 && parts[0]) {
          produtos.push({ id: parts[0], nome: parts[1] });
        }
      }
    });
    
    console.log(`✅ ${produtos.length} produtos encontrados no banco:\n`);
    
    produtos.forEach((p, i) => {
      console.log(`${i + 1}. ${p.id} - ${p.nome.substring(0, 45)}`);
    });
    
    console.log('\n📌 Copie estes IDs do ML para comparação.');
    console.log('Qual ID do banco NÃO está na lista do ML?');
    
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

main();
