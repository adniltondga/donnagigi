import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * DEBUG MOCK: Teste 3 - Buscar Detalhes dos Produtos (com dados simulados)
 * GET /api/ml/debug/items-details-mock?ids=MLB123,MLB456
 * 
 * Simula resposta de:
 * GET https://api.mercadolivre.com/items?ids=MLB123,MLB456&access_token=TOKEN
 * 
 * ⚠️ FORMATO ESPECIAL - ML retorna assim:
 * [
 *   {
 *     "code": 200,
 *     "body": {
 *       "id": "MLB4518332721",
 *       "title": "Transformador 12V 5A",
 *       "price": 199.90,
 *       "currency_id": "BRL",
 *       "inventory": {"quantity": 5},
 *       ...
 *     },
 *     "index": 0
 *   },
 *   {...}
 * ]
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');
    
    if (!ids) {
      return NextResponse.json({ 
        error: 'Parâmetro "ids" obrigatório',
        exemplo: '/api/ml/debug/items-details-mock?ids=MLB123,MLB456'
      }, { status: 400 });
    }

    // ✅ MOCK: Simular resposta com formato {code, body}
    const mockProducts = [
      {
        code: 200,
        body: {
          id: 'MLB4518332721',
          title: 'Transformador 12V 5A',
          price: 199.90,
          currency_id: 'BRL',
          category_id: 'MLB262711',
          pictures: [
            {
              id: 'pic1',
              url: 'https://example.com/pic1.jpg'
            }
          ],
          description: {
            plain_text: 'Transformador 12V 5A - Alta qualidade'
          },
          inventory: {
            quantity: 5
          },
          status: 'active'
        },
        index: 0
      },
      {
        code: 200,
        body: {
          id: 'MLB6429113696',
          title: 'Capinha Celular Premium S24',
          price: 89.90,
          currency_id: 'BRL',
          category_id: 'MLB262711',
          pictures: [
            {
              id: 'pic2',
              url: 'https://example.com/pic2.jpg'
            }
          ],
          description: {
            plain_text: 'Capinha premium para Samsung S24'
          },
          inventory: {
            quantity: 12
          },
          status: 'active'
        },
        index: 1
      }
    ];

    // Filtrar apenas os que foram pedidos (simular)
    const requestedIds = ids.split(',').map(id => id.trim());
    const filtered = mockProducts.slice(0, Math.min(requestedIds.length, mockProducts.length));

    // Mostrar desembrulhamento
    const unwrapped = filtered.map((item: any) => ({
      code: item.code,
      id: item.body?.id,
      title: item.body?.title,
      price: item.body?.price,
      quantity: item.body?.inventory?.quantity,
      status: item.body?.status
    }));

    return NextResponse.json({
      success: true,
      endpoint: '/items?ids=...',
      status: 200,
      request: {
        ids_solicitados: requestedIds,
        quantidade: requestedIds.length
      },
      response: {
        total_items: filtered.length,
        items_ok: filtered.filter((x: any) => x.code === 200).length,
        items_erro: filtered.filter((x: any) => x.code !== 200).length,
        format_raw: filtered[0],  // Mostrar formato bruto
        format_description: 'ML retorna [{code, body}, ...] - deve-se desembrulhar com .map(item => item.body)'
      },
      unwrapped: unwrapped,
      full_response: filtered
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

