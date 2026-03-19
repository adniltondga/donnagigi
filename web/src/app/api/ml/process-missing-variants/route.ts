import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Processar variações para TODOS os 25 produtos do ML
 * POST /api/ml/process-missing-variants
 */
export async function POST() {
  try {
    console.log('\n🔄 PROCESSANDO VARIAÇÕES FALTANTES\n');

    // Cores disponíveis
    const colors = ['Preto', 'Branco', 'Rosa', 'Azul', 'Vermelho'];
    const sizes = ['P', 'M', 'G', 'GG'];

    // Pegar todos os produtos do ML que NÃO têm variações
    const produtosMLSemVariacoes = await prisma.product.findMany({
      where: {
        mlListingId: { not: null },
        variants: {
          none: {}
        }
      },
      select: {
        id: true,
        name: true,
        mlListingId: true,
        baseSalePrice: true,
        minStock: true
      }
    });

    console.log(`📦 Produtos sem variações: ${produtosMLSemVariacoes.length}`);

    let variadasCriadas = 0;
    let erros = 0;

    // Para cada produto, criar 3 variações
    for (let i = 0; i < produtosMLSemVariacoes.length; i++) {
      const produto = produtosMLSemVariacoes[i];
      const index = i;

      console.log(`   [${i + 1}/${produtosMLSemVariacoes.length}] ${produto.name}...`);

      // Criar 3 variações: cores diferentes
      for (let j = 0; j < 3; j++) {
        try {
          const colorIdx = (index + j) % colors.length;
          const sizeIdx = j % sizes.length;
          const color = colors[colorIdx];
          const size = sizes[sizeIdx];

          const cod = `${produto.mlListingId?.substring(0, 8)}-COL-${color.substring(0, 2).toUpperCase()}_SIZ-${size}`;
          const precoMultiplicador = 1 + (j * 0.05);
          const novoPreco = parseFloat((produto.baseSalePrice * precoMultiplicador).toFixed(2));

          // Verificar se já existe
          const varianteExistente = await prisma.productVariant.findUnique({
            where: { cod }
          });

          if (!varianteExistente) {
            await prisma.productVariant.create({
              data: {
                productId: produto.id,
                cod: cod,
                salePrice: novoPreco,
                stock: Math.floor(produto.minStock / 2) || 1,
                active: true,
                mlListed: false
              }
            });
            variadasCriadas++;
            console.log(`      ✅ ${color} ${size} - R$ ${novoPreco}`);
          }
        } catch (err: any) {
          erros++;
          console.warn(`      ⚠️ Erro: ${err.message}`);
        }
      }
    }

    console.log(`\n✅ COMPLETO\n`);

    // Recount
    const produtosComVariacoes = await prisma.product.count({
      where: {
        mlListingId: { not: null },
        variants: {
          some: {}
        }
      }
    });

    const totalVariantes = await prisma.productVariant.count({
      where: {
        product: {
          mlListingId: { not: null }
        }
      }
    });

    return NextResponse.json({
      sucesso: true,
      resumo: {
        produtosProcessados: produtosMLSemVariacoes.length,
        variadasCriadas: variadasCriadas,
        erros: erros
      },
      stats: {
        produtosMLComVariacoes: produtosComVariacoes,
        totalVariantesML: totalVariantes
      },
      detalhes: produtosMLSemVariacoes
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
