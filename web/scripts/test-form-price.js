/**
 * Script para testar se o formulário está enviando o preço corretamente
 * 
 * Este script simula:
 * 1. Criar um produto
 * 2. Atualizar o preço de uma variação
 * 3. Validar se o preço foi atualizado
 * 
 * Uso: node scripts/test-form-price.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const fullPath = `/api${path}`;
    const url = new URL(fullPath, BASE_URL);
    const port = url.port ? parseInt(url.port) : 80;
    
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

async function testFormPrice() {
  console.log('\n📝 === TESTE DE FORMULÁRIO: EDITAR PREÇO DA VARIAÇÃO ===\n');

  try {
    // 1. Criar produto com variação inicial
    console.log('1️⃣ Criando produto com variação inicial...\n');

    const productData = {
      name: `Teste Form Preço ${new Date().getTime()}`,
      description: 'Teste para validar se o formulário enviará preço diferente',
      baseSalePrice: 50.00,
      basePurchaseCost: 20,
      baseBoxCost: 1,
      baseMLTariff: 5,
      baseDeliveryTariff: 5,
      variants: [
        {
          cod: 'FORM-TEST-001',
          stock: 10,
          salePrice: 50.00, // Preço inicial
        },
      ],
    };

    const createResponse = await request('POST', '/products', productData);

    if (createResponse.status !== 201) {
      console.log('❌ Erro ao criar produto:', createResponse.data);
      return;
    }

    const productId = createResponse.data.data.product.id;
    const variantId = createResponse.data.data.variants[0].id;

    console.log(`✅ Produto criado: ${productId}`);
    console.log(`   Variação ID: ${variantId}`);
    console.log(`   Preço inicial: R$ ${productData.variants[0].salePrice.toFixed(2)}\n`);

    // 2. Simular edição do preço (como o formulário faria)
    console.log('2️⃣ Simulando edição do preço da variação...\n');

    const newPrice = 89.99; // Novo preço que o usuário digitaria

    console.log(`📝 Atualizando preço para: R$ ${newPrice.toFixed(2)}\n`);

    const updateResponse = await request('PATCH', `/products/${productId}/variants/${variantId}`, {
      salePrice: newPrice,
      stock: 10,
    });

    if (updateResponse.status !== 200) {
      console.log('❌ Erro ao atualizar preço:', updateResponse.data);
      return;
    }

    console.log('✅ Preço atualizado na API\n');

    // 3. Buscar produto novamente para validar
    console.log('3️⃣ Buscando produto para validar mudança...\n');

    const getResponse = await request('GET', `/products?limit=1`);

    if (getResponse.status !== 200) {
      console.log('❌ Erro ao buscar produtos:', getResponse.data);
      return;
    }

    const savedProduct = getResponse.data.data.find((p) => p.id === productId);
    const savedVariant = savedProduct.variants[0];

    console.log('📥 Resultado:');
    console.log(`   Preço enviado: R$ ${newPrice.toFixed(2)}`);
    console.log(`   Preço salvo:   R$ ${savedVariant.salePrice}`);

    if (savedVariant.salePrice === newPrice) {
      console.log(`   Status: ✅ CORRETO\n`);
    } else {
      console.log(`   Status: ❌ INCORRETO\n`);
    }

    // 4. Resumo
    console.log('='.repeat(50));
    if (savedVariant.salePrice === newPrice) {
      console.log('✅ TESTE PASSOU: Formulário está enviando preços corretamente!');
    } else {
      console.log('❌ TESTE FALHOU: Preço não foi atualizado corretamente!');
      console.log('\n🔍 Isso indica que:');
      console.log('   - O formulário não está enviando o novo preço');
      console.log('   - Ou o preço está sendo zerado em algum lugar');
    }
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

console.log('🚀 Iniciando teste...');
console.log('⏳ Aguarde...\n');

setTimeout(testFormPrice, 1000);
