import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * ENDPOINT REAL: Aplicar enriquecimento de produto
 * POST /api/ml/enrich/apply
 * 
 * Body: {
 *   mlListingId: string,
 *   mapping: { ... }
 * }
 * 
 * Salva os campos mapeados no banco
 */

export async function POST(request: Request) {
  try {
    const { mlListingId, mapping } = await request.json();

    if (!mlListingId || !mapping) {
      return NextResponse.json({
        error: 'Parâmetros obrigatórios: mlListingId, mapping'
      }, { status: 400 });
    }

    // 1. Buscar produto
    const produto = await prisma.product.findFirst({
      where: { mlListingId }
    });

    if (!produto) {
      return NextResponse.json({
        error: 'Produto não encontrado',
        mlListingId
      }, { status: 404 });
    }

    // 2. Atualizar com dados do ML
    const produtoAtualizado = await prisma.product.update({
      where: { id: produto.id },
      data: {
        name: mapping.mapping.name,
        description: mapping.mapping.description,
        baseSalePrice: mapping.mapping.baseSalePrice,
        baseMLPrice: mapping.mapping.baseSalePrice, // Preço específico ML
        minStock: mapping.mapping.minStock,
        active: mapping.mapping.active,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      sucesso: true,
      mensagem: `Produto ${mlListingId} atualizado com sucesso!`,
      produto_id: produtoAtualizado.id,
      campos_atualizados: {
        nome: produtoAtualizado.name,
        preco_base: produtoAtualizado.baseSalePrice,
        preco_ml: produtoAtualizado.baseMLPrice,
        estoque_minimo: produtoAtualizado.minStock,
        ativo: produtoAtualizado.active,
        atualizado_em: produtoAtualizado.updatedAt
      }
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
