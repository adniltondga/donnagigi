#!/usr/bin/env node

/**
 * Script para testar sincronismo de Mercado Livre por partes
 * 
 * Usage:
 *   node scripts/test-ml-sync-isolated.js users-me
 *   node scripts/test-ml-sync-isolated.js items-search
 *   node scripts/test-ml-sync-isolated.js items-batch
 *   node scripts/test-ml-sync-isolated.js items-details
 *   node scripts/test-ml-sync-isolated.js all
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const ML_API = 'https://api.mercadolivre.com';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

const log = {
  title: (msg) => console.log(`\n${colors.blue}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}`),
  step: (msg) => console.log(`\n${colors.cyan}▶ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.yellow}ℹ️  ${msg}${colors.reset}`),
  debug: (msg) => console.log(`${colors.gray}🔍 ${msg}${colors.reset}`),
};

/**
 * TESTE 1: Validar Token e GET /users/me
 */
async function testUserMe() {
  log.title('TESTE 1: Validar Token e GET /users/me');
  
  try {
    // Passo 1: Carregar token do banco
    log.step('Carregando token do banco de dados...');
    const integration = await prisma.mLIntegration.findFirst();
    
    if (!integration) {
      log.error('Nenhuma integração encontrada. Execute a autenticação primeiro.');
      return false;
    }
    
    log.success('Integração encontrada no banco');
    log.debug(`Token: ${integration.accessToken.substring(0, 30)}...`);
    log.debug(`Seller ID: ${integration.sellerID}`);
    log.debug(`Expira em: ${integration.expiresAt}`);
    
    // Passo 2: Validar expiração
    log.step('Validando expiração do token...');
    if (new Date() > integration.expiresAt) {
      log.error('Token expirado!');
      return false;
    }
    log.success('Token ainda válido');
    
    // Passo 3: Fazer requisição
    log.step('Fazendo requisição GET /users/me...');
    const url = `${ML_API}/users/me?access_token=${integration.accessToken}`;
    log.debug(`URL: ${url.substring(0, 100)}...`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    log.debug(`Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const error = await response.text();
      log.error(`Erro HTTP ${response.status}`);
      log.debug(`Resposta: ${error.substring(0, 500)}`);
      return false;
    }
    
    const userData = await response.json();
    log.success('Resposta recebida com sucesso!');
    
    log.info(`Usuário: ${userData.nickname} (ID: ${userData.id})`);
    log.debug(`Status: ${userData.registration_status}`);
    log.debug(`Tipo: ${userData.account_type}`);
    
    return {
      userId: userData.id,
      nickname: userData.nickname,
      success: true
    };
    
  } catch (error) {
    log.error(`Exceção: ${error.message}`);
    return false;
  }
}

/**
 * TESTE 2: Listar Anúncios (GET /users/{id}/items/search)
 */
async function testItemsSearch(userId) {
  log.title('TESTE 2: Listar Anúncios (GET /users/{id}/items/search)');
  
  if (!userId) {
    log.error('userId não fornecido. Execute TESTE 1 primeiro.');
    return false;
  }
  
  try {
    const integration = await prisma.mLIntegration.findFirst();
    const accessToken = integration.accessToken;
    
    log.step('Fazendo requisição GET /users/{id}/items/search...');
    const url = `${ML_API}/users/${userId}/items/search?access_token=${accessToken}`;
    log.debug(`URL: ${url.substring(0, 100)}...`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    log.debug(`Status: ${response.status}`);
    
    if (!response.ok) {
      const error = await response.text();
      log.error(`Erro HTTP ${response.status}`);
      log.debug(`Resposta: ${error.substring(0, 500)}`);
      return false;
    }
    
    const data = await response.json();
    log.success('Resposta recebida com sucesso!');
    
    // Estrutura da resposta
    log.info(`Total de anúncios: ${data.paging?.total || data.results?.length}`);
    log.debug(`Offset: ${data.paging?.offset}`);
    log.debug(`Limit: ${data.paging?.limit}`);
    
    const listingIds = data.results || [];
    log.info(`Primeiros 5 IDs: ${listingIds.slice(0, 5).join(', ')}`);
    
    return {
      listingIds: listingIds,
      total: listingIds.length,
      success: true
    };
    
  } catch (error) {
    log.error(`Exceção: ${error.message}`);
    return false;
  }
}

/**
 * TESTE 3: Buscar Detalhes (GET /items?ids=...)
 */
async function testItemsBatch(listingIds) {
  log.title('TESTE 3: Buscar Detalhes (GET /items?ids=...)');
  
  if (!listingIds || listingIds.length === 0) {
    log.error('listingIds não fornecidos. Execute TESTE 2 primeiro.');
    return false;
  }
  
  try {
    const integration = await prisma.mLIntegration.findFirst();
    const accessToken = integration.accessToken;
    
    // Pegar primeiros 3 para teste
    const testIds = listingIds.slice(0, 3);
    log.info(`Testando com ${testIds.length} produtos: ${testIds.join(', ')}`);
    
    log.step('Fazendo requisição GET /items?ids=...');
    const idsString = testIds.join(',');
    const url = `${ML_API}/items?ids=${idsString}&access_token=${accessToken}`;
    log.debug(`URL: ${url.substring(0, 100)}...`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    log.debug(`Status: ${response.status}`);
    
    if (!response.ok) {
      const error = await response.text();
      log.error(`Erro HTTP ${response.status}`);
      log.debug(`Resposta: ${error.substring(0, 500)}`);
      return false;
    }
    
    const rawData = await response.json();
    log.success('Resposta recebida com sucesso!');
    
    // Análise estrutural
    log.step('Analisando estrutura da resposta...');
    log.debug(`Tipo: ${Array.isArray(rawData) ? 'Array' : typeof rawData}`);
    log.debug(`Comprimento: ${Array.isArray(rawData) ? rawData.length : 'N/A'}`);
    
    if (Array.isArray(rawData) && rawData.length > 0) {
      const firstItem = rawData[0];
      log.debug(`Primeiro item tem propriedades: ${Object.keys(firstItem).join(', ')}`);
      
      // Verificar formato wrapper
      if (firstItem.code !== undefined && firstItem.body) {
        log.info(`⚠️  Formato WRAPPER detectado: {code, body}`);
        log.debug(`  - code: ${firstItem.code}`);
        log.debug(`  - body.id: ${firstItem.body?.id}`);
        log.debug(`  - body.title: ${firstItem.body?.title}`);
      } else if (firstItem.id) {
        log.info(`✅ Formato DIRETO detectado: {...}`);
        log.debug(`  - id: ${firstItem.id}`);
        log.debug(`  - title: ${firstItem.title}`);
      }
    }
    
    // Retornar dados brutos para teste de desembrulhamento
    return {
      rawData: rawData,
      testIds: testIds,
      success: true
    };
    
  } catch (error) {
    log.error(`Exceção: ${error.message}`);
    return false;
  }
}

/**
 * TESTE 4: Desembrulhar Resposta
 */
async function testUnwrapResponse(rawData) {
  log.title('TESTE 4: Desembrulhar Resposta');
  
  if (!rawData) {
    log.error('rawData não fornecido. Execute TESTE 3 primeiro.');
    return false;
  }
  
  try {
    log.step('Aplicando desembrulhamento...');
    
    // Método de desembrulhamento
    let unwrapped;
    if (Array.isArray(rawData)) {
      unwrapped = rawData.map(item => item.body || item);
    } else {
      unwrapped = [rawData];
    }
    
    log.success('Desembrulhamento concluído!');
    log.info(`Produtos extraídos: ${unwrapped.length}`);
    
    // Analisar cada produto
    unwrapped.forEach((product, idx) => {
      log.step(`Produto ${idx + 1}: ${product.title || product.name}`);
      log.debug(`  - ID: ${product.id}`);
      log.debug(`  - Preço: R$ ${product.price}`);
      log.debug(`  - Status: ${product.status}`);
      log.debug(`  - Quantidade: ${product.inventory?.quantity || 'N/A'}`);
    });
    
    return {
      unwrapped: unwrapped,
      count: unwrapped.length,
      success: true
    };
    
  } catch (error) {
    log.error(`Exceção: ${error.message}`);
    return false;
  }
}

/**
 * TESTE 5: Verificar no Banco
 */
async function testDatabaseState() {
  log.title('TESTE 5: Estado do Banco de Dados');
  
  try {
    log.step('Verificando produtos no banco...');
    
    const products = await prisma.product.findMany();
    log.info(`Total de produtos no banco: ${products.length}`);
    
    if (products.length > 0) {
      log.debug(`\nPrimeiros 5 produtos:`);
      products.slice(0, 5).forEach((p, idx) => {
        log.debug(`  ${idx + 1}. ${p.name} (mlListingId: ${p.mlListingId}, preço: R$ ${p.baseSalePrice})`);
      });
    }
    
    // Verificar MLListingIds únicos
    const uniqueIds = new Set(products.map(p => p.mlListingId));
    log.info(`MLListingIds únicos: ${uniqueIds.size}`);
    
    if (uniqueIds.size !== products.length) {
      log.error(`⚠️  PROBLEMA: Há duplicatas! ${products.length} produtos, ${uniqueIds.size} IDs únicos`);
    }
    
    return {
      totalProducts: products.length,
      uniqueListingIds: uniqueIds.size,
      success: true
    };
    
  } catch (error) {
    log.error(`Exceção: ${error.message}`);
    return false;
  }
}

/**
 * RUNNER PRINCIPAL
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  
  try {
    let step1Result, step2Result, step3Result, step4Result, step5Result;
    
    if (command === 'all' || command === 'users-me') {
      step1Result = await testUserMe();
      if (!step1Result) {
        log.error('TESTE 1 falhou. Encerrando.');
        process.exit(1);
      }
    }
    
    if (command === 'all' || command === 'items-search') {
      step2Result = await testItemsSearch(step1Result?.userId);
      if (!step2Result) {
        log.error('TESTE 2 falhou. Encerrando.');
        process.exit(1);
      }
    }
    
    if (command === 'all' || command === 'items-batch') {
      step3Result = await testItemsBatch(step2Result?.listingIds);
      if (!step3Result) {
        log.error('TESTE 3 falhou. Encerrando.');
        process.exit(1);
      }
    }
    
    if (command === 'all' || command === 'items-details') {
      step4Result = await testUnwrapResponse(step3Result?.rawData);
      if (!step4Result) {
        log.error('TESTE 4 falhou. Encerrando.');
        process.exit(1);
      }
    }
    
    if (command === 'all' || command === 'db-state') {
      step5Result = await testDatabaseState();
    }
    
    log.title('✅ TODOS OS TESTES CONCLUÍDOS COM SUCESSO');
    
  } catch (error) {
    log.error(`Erro fatal: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
