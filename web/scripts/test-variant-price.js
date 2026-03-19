/**
 * Script de teste automatizado para validar se o salePrice das variações está sendo salvo corretamente
 * 
 * Uso: node scripts/test-variant-price.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const BACKUP_URL = 'http://localhost:3001';

let API_URL = BASE_URL;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const fullPath = `/api${path}`;
    const url = new URL(fullPath, API_URL);
    const port = url.port ? parseInt(url.port) : url.protocol === 'https:' ? 443 : 80;
    
    const options = {
      hostname: url.hostname,
      port: port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch {
          resolve({
            status: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testVariantPrice() {
  console.log('\n📝 === TESTE DE SALVAR PREÇO DA VARIAÇÃO ===\n');

  // Tentar detectar qual porta está funcionando
  console.log('🔍 Detectando porta do servidor...\n');
  
  try {
    let testRes = await request('GET', '/products?limit=1');
    if (testRes.status === 404 && !testRes.data.success) {
      // Tenta porta 3001
      API_URL = BACKUP_URL;
      console.log('⚠️  Porta 3000 não respondeu, tentando 3001...\n');
      testRes = await request('GET', '/products?limit=1');
    }
    console.log(`✅ Conectado em: ${API_URL}\n`);
  } catch (error) {
    console.error('❌ Nenhuma porta respondeu! Tente rodar: npm run dev', error.message);
    return;
  }

  try {
    // 1. Criar produto com variação
    console.log('1️⃣ Criando produto de teste...\n');

    const productData = {
      name: `Teste Preço Variação ${new Date().getTime()}`,
      description: 'Produto de teste para validar salePrice',
      baseSalePrice: 99.99,
      basePurchaseCost: 30,
      baseBoxCost: 1.5,
      baseMLTariff: 10,
      baseDeliveryTariff: 10,
      variants: [
        {
          cod: 'TEST-VAR-001',
          stock: 10,
          salePrice: 99.99, // Preço que queremos testar
        },
        {
          cod: 'TEST-VAR-002',
          stock: 5,
          salePrice: 120.00, // Preço diferente
        },
      ],
    };

    console.log('📤 Enviando dados:');
    console.log(JSON.stringify(productData, null, 2));

    const createResponse = await request('POST', '/products', productData);

    if (createResponse.status !== 201) {
      console.log('❌ Erro ao criar produto:', createResponse.data);
      return;
    }

    const productId = createResponse.data.data.product.id;
    console.log(`\n✅ Produto criado com ID: ${productId}`);
    console.log(`   Variações criadas: ${createResponse.data.data.variants.length}`);

    console.log('\n📥 Variações retornadas pela API:');
    createResponse.data.data.variants.forEach((v, i) => {
      console.log(`   Variação ${i + 1}:`);
      console.log(`     - COD: ${v.cod}`);
      console.log(`     - salePrice: ${v.salePrice}`);
      console.log(`     - stock: ${v.stock}`);
    });

    // 2. Buscar o produto novamente para verificar se foi salvo
    console.log('\n2️⃣ Buscando produto para validar dados salvos...\n');

    const getResponse = await request('GET', `/products?limit=1`);

    if (getResponse.status !== 200) {
      console.log('❌ Erro ao buscar produtos:', getResponse.data);
      return;
    }

    const savedProduct = getResponse.data.data.find((p) => p.id === productId);

    if (!savedProduct) {
      console.log('❌ Produto não encontrado na busca!');
      return;
    }

    console.log('📥 Produto encontrado no banco de dados:');
    console.log(`   Nome: ${savedProduct.name}`);
    console.log(`   baseSalePrice: ${savedProduct.baseSalePrice}`);
    console.log(`   Total de variações: ${savedProduct.variants.length}`);

    // 3. Validar os preços das variações
    console.log('\n3️⃣ Validando preços das variações salvos:\n');

    let allValid = true;

    savedProduct.variants.forEach((variant, i) => {
      const expected = productData.variants[i];
      const isValid = variant.salePrice === expected.salePrice;

      console.log(`   Variação ${i + 1} (${variant.cod}):`);
      console.log(`     - Enviado: R$ ${expected.salePrice.toFixed(2)}`);
      console.log(`     - Salvo:   R$ ${variant.salePrice}`);
      console.log(`     - Status:  ${isValid ? '✅ OK' : '❌ ERRO'}`);

      if (!isValid) {
        allValid = false;
      }
    });

    // 4. Resumo final
    console.log('\n' + '='.repeat(50));
    if (allValid) {
      console.log('✅ TESTE PASSOU: Todos os preços foram salvos corretamente!');
    } else {
      console.log('❌ TESTE FALHOU: Alguns preços não foram salvos corretamente!');
      console.log('\n🔍 Possíveis problemas:');
      console.log('   1. O salePrice está chegando como 0 ou undefined');
      console.log('   2. O CurrencyInput não está convertendo corretamente');
      console.log('   3. A API POST não está processando o salePrice');
    }
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

console.log('🚀 Iniciando teste...');
console.log('⏳ Aguarde a conexão...\n');

// Espera um pouco para garantir que o servidor está pronto
setTimeout(testVariantPrice, 2000);
