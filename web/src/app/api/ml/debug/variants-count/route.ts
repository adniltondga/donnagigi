import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * DEBUG: Contar variantes por produto
 * GET /api/ml/debug/variants-count
 */
export async function GET() {
  try {
    // Contar total de variantes no banco
    const totalVariantes = await prisma.productVariant.count();

    // Contar produtos com variantes
    const produtosComVariantes = await prisma.product.findMany({
      where: {
        variants: {
          some: {} // tem pelo menos uma variante
        }
      },
      select: {
        id: true,
        name: true,
        mlListingId: true,
        _count: {
          select: { variants: true }
        }
      }
    });

    // Detalhes dos primeiros 5
    const detalhes = produtosComVariantes.slice(0, 5).map(p => ({
      name: p.name,
      mlListingId: p.mlListingId,
      totalVariantes: p._count.variants
    }));

    return NextResponse.json({
      resumo: {
        totalVariantesNoBanco: totalVariantes,
        produtosComVariantes: produtosComVariantes.length,
        totalProdutos: await prisma.product.count()
      },
      detalhes,
      detalheCompleto: produtosComVariantes
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
