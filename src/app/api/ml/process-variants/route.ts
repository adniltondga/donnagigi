import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * ENDPOINT: Processar variações de um produto
 * GET /api/ml/process-variants?mlListingId=MLB123...
 * 
 * Fluxo:
 * 1. Buscar produto no banco
 * 2. Simular dados de variações do ML
 * 3. Para cada variação, criar ProductVariant
 * 4. Retornar resumo
 */

interface VariacaoML {
  id: string;
  attribute_combinations: Array<{
    name: string;
    value: string;
  }>;
  price: number;
  available_quantity: number;
  picture_ids?: string[];
}

// Mock: Simular variações que viriam do ML
function getMockVariations(mlListingId: string): VariacaoML[] {
  // Alguns produtos têm variações, outros não
  const hasVariations = Math.random() > 0.5;
  
  if (!hasVariations) {
    return []; // Produto sem variações
  }

  // Produto com variações de cor
  const cores = ['Preto', 'Branco', 'Azul', 'Rosa'];
  return cores.slice(0, 2 + Math.floor(Math.random() * 2)).map((cor, idx) => ({
    id: `${mlListingId}-VAR-${idx}`,
    attribute_combinations: [
      { name: 'color', value: cor }
    ],
    price: 99.90 + (idx * 10),
    available_quantity: 2 + idx,
    picture_ids: [`pic_${idx}`]
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mlListingId = searchParams.get('mlListingId');

    if (!mlListingId) {
      return NextResponse.json({
        error: 'mlListingId obrigatório',
        exemplo: '/api/ml/process-variants?mlListingId=MLB0000000025'
      }, { status: 400 });
    }

    // 1. Buscar produto existente
    const produto = await prisma.product.findFirst({
      where: { mlListingId },
      include: { variants: true }
    });

    if (!produto) {
      return NextResponse.json({
        error: 'Produto não encontrado',
        mlListingId
      }, { status: 404 });
    }

    // 2. Buscar variações do ML (mock)
    const variacoes = getMockVariations(mlListingId);

    console.log(`\n📦 Processando variações de ${mlListingId}`);
    console.log(`   Variações encontradas no ML: ${variacoes.length}`);
    console.log(`   Variações existentes no BD: ${produto.variants.length}`);

    // 3. Processar cada variação
    const resultados = {
      produto_id: produto.id,
      mlListingId: mlListingId,
      variacoes_ml: variacoes.length,
      variacoes_criadas: 0,
      variacoes_existentes: produto.variants.length,
      detalhes: [] as any[]
    };

    for (const variacao of variacoes) {
      try {
        // Gerar um código único para a variante
        const atributos = variacao.attribute_combinations
          .map(attr => `${attr.name.substring(0, 3)}-${attr.value.substring(0, 2)}`.toUpperCase())
          .join('_');
        const cod = `${mlListingId.substring(0, 6)}-${atributos}`;

        // Verificar se já existe
        const varianteExistente = await prisma.productVariant.findUnique({
          where: { cod }
        });

        if (varianteExistente) {
          resultados.detalhes.push({
            variacao_id: variacao.id,
            status: 'JA_EXISTE',
            cod: cod,
            mensagem: 'Variante já existe no banco'
          });
          continue;
        }

        // Criar variante
        const novaVariante = await prisma.productVariant.create({
          data: {
            productId: produto.id,
            cod: cod,
            salePrice: variacao.price,
            stock: variacao.available_quantity,
            active: true,
            mlListed: false
            // Futura: colorId se for cor
            // Futura: modelId se for modelo
          }
        });

        resultados.variacoes_criadas++;
        resultados.detalhes.push({
          variacao_id: variacao.id,
          status: 'CRIADA',
          cod: novaVariante.cod,
          preco: variacao.price,
          estoque: variacao.available_quantity,
          atributos: variacao.attribute_combinations
        });

      } catch (erro: any) {
        resultados.detalhes.push({
          variacao_id: variacao.id,
          status: 'ERRO',
          erro: erro.message
        });
      }
    }

    return NextResponse.json({
      sucesso: true,
      resumo: {
        produto: produto.name,
        mlListingId: mlListingId,
        variacoes_no_ml: variacoes.length,
        variacoes_criadas_agora: resultados.variacoes_criadas,
        variacoes_totais: produto.variants.length + resultados.variacoes_criadas
      },
      detalhes: resultados.detalhes,
      proximos_passos: variacoes.length === 0 
        ? ['Este produto não tem variações no ML']
        :  [
          'Variações foram processadas',
          'Próximo: Integrar no batch de sincronismo',
          'Últimas: Processar para todos os produtos'
        ]
    });

  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
