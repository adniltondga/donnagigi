import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * SYNC ENDPOINT (MOCK) - Teste Completo
 * GET /api/ml/sync-mock
 * 
 * Fluxo:
 * 1. Validar token
 * 2. GET /users/me (mock)
 * 3. GET /items/search (mock) → 41 IDs
 * 4. Slice 25 primeiros IDs
 * 5. Loop em batches de 3
 * 6. GET /items?ids=... (mock) com formato {code,body}
 * 7. Desembrulhar: .map(item => item.body)
 * 8. Upsert cada produto
 * 9. Return stats
 */

// Mock de 41 IDs
const MOCK_ALL_IDS = [
  'MLB4518332721', 'MLB6429113696', 'MLB4429331221',
  'MLB1111111111', 'MLB2222222222', 'MLB3333333333',
  'MLB4444444444', 'MLB5555555555', 'MLB6666666666',
  'MLB7777777777', 'MLB8888888888', 'MLB9999999999',
  'MLB1010101010', 'MLB1111111112', 'MLB1212121212',
  'MLB1313131313', 'MLB1414141414', 'MLB1515151515',
  'MLB1616161616', 'MLB1717171717', 'MLB1818181818',
  'MLB1919191919', 'MLB2020202020', 'MLB2121212121',
  'MLB2222222223', 'MLB2323232323', 'MLB2424242424',
  'MLB2525252525', 'MLB2626262626', 'MLB2727272727',
  'MLB2828282828', 'MLB2929292929', 'MLB3030303030',
  'MLB3131313131', 'MLB3232323232', 'MLB3333333334',
  'MLB3434343434', 'MLB3535353535', 'MLB3636363636',
  'MLB3737373737', 'MLB3838383838'
];

// Mock de produtos com dados variados
function generateMockProduct(index: number, mlId: string) {
  const basePrice = 50 + (index * 5.5);
  const quantity = 1 + (index % 15);
  
  return {
    code: 200,
    body: {
      id: mlId,
      title: `Produto #${index + 1} - ${mlId}`,
      price: parseFloat(basePrice.toFixed(2)),
      currency_id: 'BRL',
      category_id: 'MLB262711',
      pictures: [{ id: `pic${index}`, url: `https://example.com/pic${index}.jpg` }],
      description: {
        plain_text: `Descrição do produto ${index + 1} - ID: ${mlId}`
      },
      inventory: {
        quantity: quantity
      },
      status: 'active'
    },
    index: index
  };
}

export async function GET() {
  try {
    console.log('\n📍 SYNC MOCK - Iniciando sincronismo...\n');

    // === PASSO 1: Validar Token ===
    const integration = await prisma.mLIntegration.findFirst();
    if (!integration) {
      return NextResponse.json({ error: 'Sem token no banco' }, { status: 401 });
    }
    console.log(`✅ Token encontrado (Seller: ${integration.sellerID})`);

    // === PASSO 2: Simular /users/me ===
    console.log(`📡 Step 1: GET /users/me`);
    const userDataMock = {
      id: integration.sellerID,
      nickname: 'DONNAGIGI',
      registration_status: 'confirmed',
      account_type: 'business'
    };
    console.log(`   ✅ Seller: ${userDataMock.nickname} (ID: ${userDataMock.id})`);

    // === PASSO 3: Simular /items/search ===
    console.log(`📡 Step 2: GET /users/{id}/items/search`);
    console.log(`   ✅ Produtos listados: ${MOCK_ALL_IDS.length}`);

    // === PASSO 4: Slice 25 primeiros ===
    const TARGET_COUNT = 25;
    const idsToSync = MOCK_ALL_IDS.slice(0, TARGET_COUNT);
    console.log(`📡 Step 3: Selecionando ${TARGET_COUNT} produtos para sincronizar`);
    console.log(`   IDs: ${idsToSync.slice(0, 3).join(', ')} ... (${idsToSync.length} total)`);

    // === PASSO 5: Loop em batches ===
    const BATCH_SIZE = 5; // Simular batches de 5
    let productsProcessed = 0;
    let productsSaved = 0;
    let errors = 0;

    console.log(`\n📦 Processando em batches de ${BATCH_SIZE}...\n`);

    for (let i = 0; i < idsToSync.length; i += BATCH_SIZE) {
      const batchIds = idsToSync.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(idsToSync.length / BATCH_SIZE);

      console.log(`   [Batch ${batchNum}/${totalBatches}] Processando ${batchIds.length} produtos...`);

      // === PASSO 6: Simular GET /items?ids=... com formato {code, body} ===
      const mockResponse = batchIds.map((id, idx) => generateMockProduct(i + idx, id));

      // === PASSO 7: DESEMBRULHAR - CRÍTICO! ===
      const unwrapped = mockResponse.map((item: any) => item.body || item);
      console.log(`      Unwrapped: ${unwrapped.length} produtos`);

      // === PASSO 8: Upsert cada produto ===
      for (const product of unwrapped) {
        try {
          if (!product?.id) {
            console.log(`      ❌ Produto sem ID: ${JSON.stringify(product).substring(0, 50)}`);
            errors++;
            continue;
          }

          console.log(`      Salvando: ${product.id} - ${product.title}`);

          // Primeiro tenta encontrar por mlListingId
          const existing = await prisma.product.findFirst({
            where: { mlListingId: product.id }
          });

          let saved;
          if (existing) {
            // Update
            saved = await prisma.product.update({
              where: { id: existing.id },
              data: {
                name: product.title,
                description: product.description?.plain_text || 'N/A',
                baseSalePrice: product.price,
                minStock: product.inventory?.quantity || 0,
                active: product.status === 'active'
              }
            });
          } else {
            // Create
            saved = await prisma.product.create({
              data: {
                mlListingId: product.id,
                name: product.title,
                description: product.description?.plain_text || 'N/A',
                baseSalePrice: product.price,
                minStock: product.inventory?.quantity || 0,
                active: product.status === 'active'
              }
            });
          }

          productsSaved++;
          console.log(`      ✅ Salvo: ${product.title} (R$ ${product.price}, Stock: ${product.inventory?.quantity || 0})`);
        } catch (err: any) {
          errors++;
          console.error(`      ❌ Erro DB: ${product?.id} - ${err.message}`);
        }
      }

      productsProcessed += batchIds.length;
    }

    // === PASSO 9: Return Stats ===
    console.log(`\n✅ SINCRONISMO CONCLUÍDO\n`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      seller: {
        id: integration.sellerID,
        nickname: userDataMock.nickname
      },
      stats: {
        total_produtos_ml: MOCK_ALL_IDS.length,
        alvo_sincronismo: TARGET_COUNT,
        processados: productsProcessed,
        salvos_db: productsSaved,
        erros: errors,
        taxa_sucesso: `${((productsSaved / productsProcessed) * 100).toFixed(1)}%`
      },
      processo: {
        step1: 'GET /users/me ✅',
        step2: 'GET /items/search ✅',
        step3: `Selecionada 25 de 41 produtos ✅`,
        step4: `Processados em ${Math.ceil(idsToSync.length / BATCH_SIZE)} batches ✅`,
        step5: 'Response desembrulhada e salva ✅'
      }
    });

  } catch (error: any) {
    console.error('[ERROR]', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
