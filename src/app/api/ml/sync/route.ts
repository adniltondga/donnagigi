import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const ML_API = 'https://api.mercadolivre.com';
const BATCH_SIZE = 20; // Máximo de IDs por requisição de detalhes
const MAX_PRODUCTS = 25; // Máximo de produtos a sincronizar

/**
 * DOCUMENTAÇÃO DE REFERÊNCIA:
 * https://developers.mercadolivre.com.br
 * 
 * Fluxo de sincronização (conforme doc oficial):
 * 1. GET /users/me (Bearer token no header) → obter seller_id
 * 2. GET /users/{user_id}/items/search (Bearer token no header) → listar IDs dos anúncios
 * 3. GET /items?ids=ID1,ID2,ID3 (Bearer token no header) → buscar detalhes em batch (até 20 IDs)
 * 4. Salvar/atualizar os produtos no banco de dados
 */

interface MLProduct {
  id: string;
  title: string;
  price: number;
  status: string;
  description?: string;
  initial_quantity?: number;
  sold_quantity?: number;
}

/**
 * Helper para fazer requisições com retry e backoff exponencial
 * Tenta até 3 vezes, aguardando 1s, 2s, 4s entre tentativas
 */
async function fetchWithRetry(url: string, options: any = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📍 Tentativa ${attempt}/${maxRetries}: ${url.substring(0, 100)}`);
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      console.error(`❌ Tentativa ${attempt} falhou:`, error);
      if (attempt === maxRetries) {
        throw error;
      }
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`⏱️ Aguardando ${delay}ms antes da próxima tentativa...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Busca detalhes de múltiplos produtos em uma só requisição
 * Endpoint: GET /items?ids=MLB123,MLB456,MLB789
 * Retorna array de produtos com todos os detalhes
 */
async function fetchProductsBatch(
  productIds: string[],
  accessToken: string
): Promise<MLProduct[]> {
  if (productIds.length === 0) return [];

  // Limitar a 20 IDs por requisição (limite da API)
  const ids = productIds.slice(0, BATCH_SIZE).join(',');
  const url = `${ML_API}/items?ids=${ids}&access_token=${accessToken}`;

  console.log(`  📦 Buscando detalhes de ${productIds.length} produtos (batch)...`);

  const res = await fetchWithRetry(url, {
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!res || !res.ok) {
    const errorText = res ? await res.text() : 'No response';
    console.error('  ❌ Erro ao buscar batch:', { status: res?.status, body: errorText?.substring(0, 200) });
    throw new Error(`Falha ao buscar detalhes (${res?.status || 'no-response'})`);
  }

  let data = await res.json();
  if (data.results) {
    data = data.results;
  }

  // Desembrulhar items com code/body wrapper (Mercado Livre bulk API format)
  if (Array.isArray(data)) {
    data = data.map((item: any) => item.body || item);
  }

  console.log(`  ✅ Recebidos ${Array.isArray(data) ? data.length : 1} produtos`);
  return Array.isArray(data) ? data : [data];
}

export async function GET() {
  try {
    console.log('🚀 ========== SINCRONISMO MERCADO LIVRE ==========');
    console.log('📡 Iniciando sincronismo com Mercado Livre...');
    console.log(`⚙️ Config: MAX_PRODUCTS=${MAX_PRODUCTS}, BATCH_SIZE=${BATCH_SIZE}`);

    console.log(`⚙️ Config: MAX_PRODUCTS=${MAX_PRODUCTS}, BATCH_SIZE=${BATCH_SIZE}`);

    // ============ PASSO 1: Validar autenticação ============
    console.log('\n📍 PASSO 1: Validando autenticação...');
    const integration = await prisma.mLIntegration.findFirst();

    console.log('🔍 Integration do banco:', integration ? 'Encontrada' : 'NÃO ENCONTRADA');

    if (!integration || !integration.accessToken) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Você não está autenticado com Mercado Livre. Por favor, clique em "Conectar via Mercado Livre" primeiro.',
          code: 'NOT_AUTHENTICATED'
        },
        { status: 401 }
      );
    }

    console.log('✅ Token encontrado no banco de dados');
    console.log('🔐 Token (primeiros 30 chars):', integration.accessToken.substring(0, 30) + '...');

    const accessToken = integration.accessToken;

    // ============ PASSO 2: Obter dados do usuário ============
    console.log('\n📍 PASSO 2: Obtendo dados do usuário (GET /users/me)...');
    
    let userRes;
    try {
      // Usar query string para autenticação (mais confiável)
      userRes = await fetchWithRetry(`${ML_API}/users/me?access_token=${accessToken}`, {
        headers: {
          'Accept': 'application/json'
        }
      });
    } catch (fetchError) {
      console.error('❌ Erro ao conectar em /users/me:', fetchError);
      throw new Error(`Erro de conexão com Mercado Livre: ${fetchError}`);
    }

    console.log('✅ Resposta recebida de /users/me, status:', userRes?.status);

    if (!userRes) {
      throw new Error('Falha ao obter dados do usuário: resposta vazia');
    }

    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error('❌ Erro ao obter /users/me:', {
        status: userRes.status,
        statusText: userRes.statusText,
        body: errorText
      });
      throw new Error(`Falha ao obter dados do usuário (${userRes.status}): ${errorText}`);
    }

    const userData: any = await userRes.json();
    const sellerId = userData.id;

    console.log(`✅ Usuário identificado: ${userData.nickname} (ID: ${sellerId})`);

    // ============ PASSO 3: Listar anúncios ============
    console.log('\n📍 PASSO 3: Listando anúncios (GET /users/{id}/items/search)...');
    const itemsRes = await fetchWithRetry(
      `${ML_API}/users/${sellerId}/items/search?access_token=${accessToken}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!itemsRes || !itemsRes.ok) {
      const errorText = await itemsRes?.text();
      console.error('❌ Erro ao obter anúncios:', {
        status: itemsRes?.status,
        body: errorText
      });
      throw new Error('Falha ao obter anúncios');
    }

    const itemsData: any = await itemsRes.json();
    const allListingIds: string[] = itemsData.results || [];

    if (!Array.isArray(allListingIds) || allListingIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum anúncio encontrado para sincronizar',
        stats: {
          total: 0,
          synced: 0,
          failed: 0
        }
      });
    }

    console.log(`✅ Encontrados ${allListingIds.length} anúncios no Mercado Livre`);
    console.log(`📦 Sincronizando os primeiros ${Math.min(allListingIds.length, MAX_PRODUCTS)}...`);

    // ============ PASSO 4: Buscar detalhes em batches ============
    console.log('\n📍 PASSO 4: Buscando detalhes dos produtos...');

    
    const listingIdsToSync = allListingIds.slice(0, MAX_PRODUCTS);
    const syncedProducts: any[] = [];
    const errors: any[] = [];

    // Processar em batches de BATCH_SIZE
    for (let i = 0; i < listingIdsToSync.length; i += BATCH_SIZE) {
      const batchIds = listingIdsToSync.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}: Processando ${batchIds.length} produtos...`);

      try {
        const products = await fetchProductsBatch(batchIds, accessToken);

        // ============ PASSO 5: Salvar/atualizar no banco ============
        for (const mlProduct of products) {
          try {
            console.log(`  📍 Processando: ${mlProduct.title}`);

            // Verificar se já existe
            let dbProduct = await prisma.product.findFirst({
              where: { mlListingId: mlProduct.id },
            });

            if (!dbProduct) {
              // Criar novo
              dbProduct = await prisma.product.create({
                data: {
                  name: mlProduct.title,
                  description: mlProduct.description || '',
                  mlListingId: mlProduct.id,
                  baseSalePrice: mlProduct.price,
                  minStock: 5,
                  active: mlProduct.status === 'active',
                },
              });
              console.log(`    ✅ Novo produto criado: ${dbProduct.name}`);
            } else {
              // Atualizar existente
              dbProduct = await prisma.product.update({
                where: { id: dbProduct.id },
                data: {
                  name: mlProduct.title,
                  baseSalePrice: mlProduct.price,
                  active: mlProduct.status === 'active',
                },
              });
              console.log(`    🔄 Produto atualizado: ${dbProduct.name}`);
            }

            syncedProducts.push({
              id: dbProduct.id,
              name: dbProduct.name,
              mlListingId: mlProduct.id,
              price: mlProduct.price,
              status: mlProduct.status,
            });
          } catch (error) {
            console.error(`    ❌ Erro ao salvar ${mlProduct.id}:`, error);
            errors.push({
              listingId: mlProduct.id,
              title: mlProduct.title,
              error: String(error),
            });
          }
        }
      } catch (error) {
        console.error(`❌ Erro no batch:`, error);
        // Registrar IDs que falharam
        for (const id of batchIds) {
          errors.push({
            listingId: id,
            error: String(error),
          });
        }
      }

      // Pequeno delay entre batches
      if (i + BATCH_SIZE < listingIdsToSync.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // ============ RESULTADO FINAL ============
    console.log('\n🎉 ========== SINCRONISMO CONCLUÍDO ==========');
    console.log(`✅ Sincronizados: ${syncedProducts.length} produtos`);
    console.log(`❌ Falharam: ${errors.length} produtos`);
    console.log(`📊 Total listados: ${allListingIds.length} anúncios`);

    return NextResponse.json(
      {
        success: true,
        message: `${syncedProducts.length} produtos sincronizados com sucesso`,
        data: syncedProducts,
        errors: errors.length > 0 ? errors : undefined,
        stats: {
          totalListings: allListingIds.length,
          synced: syncedProducts.length,
          failed: errors.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ ERRO CRÍTICO:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: `Erro ao sincronizar: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
