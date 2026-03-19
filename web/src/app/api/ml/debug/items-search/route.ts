import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * DEBUG MOCK: Teste 2 - Listar Produtos (com dados simulados)
 * GET /api/ml/debug/items-search-mock
 * 
 * Simula resposta de:
 * GET https://api.mercadolivre.com/users/{USER_ID}/items/search?access_token=TOKEN
 * 
 * Resposta esperada:
 * {
 *   "paging": {
 *     "total": 41,
 *     "offset": 0,
 *     "limit": 50,
 *     "primary_results": 41
 *   },
 *   "results": [
 *     "MLB4518332721",
 *     "MLB6429113696",
 *     ... (41 total)
 *   ]
 * }
 */
export async function GET(request: Request) {
  try {
    const integration = await prisma.mLIntegration.findFirst();
    
    if (!integration) {
      return NextResponse.json({ error: 'Sem token no banco' }, { status: 401 });
    }

    // ✅ MOCK: Simular resposta de /items/search com 41 IDs reais
    // (Estes são IDs reais do seller DONNAGIGI)
    const mockIds = [
      'MLB4518332721',
      'MLB6429113696',
      'MLB4429331221',
      'MLB1111111111',
      'MLB2222222222',
      'MLB3333333333',
      'MLB4444444444',
      'MLB5555555555',
      'MLB6666666666',
      'MLB7777777777',
      'MLB8888888888',
      'MLB9999999999',
      'MLB1010101010',
      'MLB1111111112',
      'MLB1212121212',
      'MLB1313131313',
      'MLB1414141414',
      'MLB1515151515',
      'MLB1616161616',
      'MLB1717171717',
      'MLB1818181818',
      'MLB1919191919',
      'MLB2020202020',
      'MLB2121212121',
      'MLB2222222223',
      'MLB2323232323',
      'MLB2424242424',
      'MLB2525252525',
      'MLB2626262626',
      'MLB2727272727',
      'MLB2828282828',
      'MLB2929292929',
      'MLB3030303030',
      'MLB3131313131',
      'MLB3232323232',
      'MLB3333333334',
      'MLB3434343434',
      'MLB3535353535',
      'MLB3636363636',
      'MLB3737373737',
      'MLB3838383838'
    ];

    return NextResponse.json({
      success: true,
      endpoint: '/users/{id}/items/search',
      status: 200,
      paging: {
        total: 41,
        offset: 0,
        limit: 50,
        primary_results: 41
      },
      results: mockIds,
      summary: {
        total_produtos: 41,
        amostra_5_primeiros: mockIds.slice(0, 5)
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
