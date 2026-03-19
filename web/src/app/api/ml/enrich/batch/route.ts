import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * ENDPOINT EM BATCH: Enriquecer todos os 25 produtos
 * GET /api/ml/enrich/batch
 * 
 * 1. Busca todos os produtos com mlListingId
 * 2. Para cada um, simula fetch de detalhes do ML
 * 3. Mapeia e salva no banco
 * 
 * Retorna: resumo com quantos foram atualizados
 */

interface MLProductResponse {
  id: string;
  title: string;
  price: number;
  currency_id: string;
  status: string;
  description?: { plain_text: string };
  inventory?: { quantity: number };
  pictures?: Array<{ url: string; id: string }>;
  category_id?: string;
}

function getMockMLProduct(mlListingId: string): MLProductResponse {
  // Simular como se buscasse da API real
  // Em produção: const response = await fetch(`https://api.mercadolivre.com/items/${mlListingId}`)
  
  const precos = [99.90, 149.90, 199.90, 89.90, 179.90, 69.90, 249.90, 119.90];
  const index = Math.abs(parseInt(mlListingId.replace('MLB', '')) % precos.length);
  
  return {
    id: mlListingId,
    title: `Produto ${mlListingId} - Premium`,
    price: precos[index],
    currency_id: 'BRL',
    status: 'active',
    description: {
      plain_text: `Este é um produto de qualidade premium com código ${mlListingId}. Descrição enriquecida do Mercado Livre com todas as características.`
    },
    inventory: {
      quantity: 5 + index
    },
    pictures: [
      { id: 'pic1', url: `https://example.com/produtos/${mlListingId}.jpg` }
    ],
    category_id: 'MLB262711'
  };
}

export async function GET(request: Request) {
  try {
    console.log('🔄 Iniciando enriquecimento em batch de produtos...');

    // 1. Buscar todos os produtos com mlListingId
    const produtos = await prisma.product.findMany({
      where: {
        mlListingId: { not: null }
      },
      select: {
        id: true,
        mlListingId: true,
        name: true,
        baseSalePrice: true
      }
    });

    console.log(`✅ Encontrados ${produtos.length} produtos para enriquecer`);

    const resultados = {
      total: produtos.length,
      atualizados: 0,
      erros: 0,
      detalhes: [] as any[]
    };

    // 2. Para cada produto, atualizar
    for (const produto of produtos) {
      try {
        // Buscar detalhes do ML (mock)
        const mlProduct = getMockMLProduct(produto.mlListingId!);

        // Atualizar no banco
        const atualizado = await prisma.product.update({
          where: { id: produto.id },
          data: {
            name: mlProduct.title,
            description: mlProduct.description?.plain_text || '',
            baseSalePrice: mlProduct.price,
            baseMLPrice: mlProduct.price,
            minStock: mlProduct.inventory?.quantity || 5,
            active: mlProduct.status === 'active'
          }
        });

        resultados.atualizados++;
        resultados.detalhes.push({
          mlListingId: produto.mlListingId,
          antes: {
            nome: produto.name,
            preco: produto.baseSalePrice
          },
          depois: {
            nome: atualizado.name,
            preco: atualizado.baseSalePrice,
            estoque: atualizado.minStock
          },
          status: 'OK'
        });

      } catch (erro: any) {
        resultados.erros++;
        resultados.detalhes.push({
          mlListingId: produto.mlListingId,
          erro: erro.message,
          status: 'ERRO'
        });
      }
    }

    return NextResponse.json({
      sucesso: true,
      resumo: {
        total_processados: resultados.total,
        atualizados: resultados.atualizados,
        erros: resultados.erros,
        taxa_sucesso: `${((resultados.atualizados / resultados.total) * 100).toFixed(1)}%`
      },
      primeiros_5_resultados: resultados.detalhes.slice(0, 5),
      ultimos_5_resultados: resultados.detalhes.slice(-5)
    });

  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
