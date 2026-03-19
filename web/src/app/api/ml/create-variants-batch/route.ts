import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Criar variações para os 20 produtos do ML faltantes (MLB0000000006 até MLB0000000025)
 * POST /api/ml/create-variants-batch
 */
export async function POST() {
  try {
    console.log('\n📦 CRIANDO VARIAÇÕES EM BATCH\n');

    // IDs dos 20 produtos que faltam variações
    const targetIds = Array.from({ length: 20 }, (_, i) => {
      const num = String(6 + i).padStart(10, '0');
      return `MLB${num}`;
    });

    console.log(`🎯 Target: ${targetIds.length} produtos`);
    console.log(`   ${targetIds[0]} até ${targetIds[targetIds.length - 1]}`);

    // Pegar esses produtos
    const produtos = await prisma.product.findMany({
      where: {
        mlListingId: { in: targetIds }
      },
      select: {
        id: true,
        name: true,
        mlListingId: true,
        baseSalePrice: true,
        minStock: true
      }
    });

    console.log(`\n✅ Encontrados: ${produtos.length} produtos\n`);

    let variadasCriadas = 0;
    let erros = 0;

    // Cores e tamanhos
    const colors = ['Preto', 'Branco', 'Rosa', 'Azul', 'Vermelho'];
    const sizes = ['P', 'M', 'G'];

    // Para cada produto, criar 3 variações
    for (let i = 0; i < produtos.length; i++) {
      const produto = produtos[i];

      console.log(`   [${i + 1}/${produtos.length}] ${produto.name}...`);

      // Criar 3 variações
      for (let j = 0; j < 3; j++) {
        try {
          const colorIdx = (i + j) % colors.length;
          const sizeIdx = j % sizes.length;
          const color = colors[colorIdx];
          const size = sizes[sizeIdx];

          // Gerar código ÚNICO (adicionar hash pra evitar duplicatas)
          const colorCode = color.substring(0, 2).toUpperCase();
          const hash = Math.random().toString(36).substring(7);
          const cod = `${produto.mlListingId?.substring(0, 8)}-${colorCode}-${size}-${hash}`;
          
          const precoBase = produto.baseSalePrice || 50;
          const precoMultiplicador = 1 + (j * 0.05);
          const novoPreco = parseFloat((precoBase * precoMultiplicador).toFixed(2));

          // Criar
          await prisma.productVariant.create({
            data: {
              productId: produto.id,
              cod: cod,
              salePrice: novoPreco,
              stock: Math.floor((produto.minStock || 10) / 2),
              active: true,
              mlListed: false
            }
          });

          variadasCriadas++;
          console.log(`      ✅ ${color} ${size} - R$ ${novoPreco}`);
        } catch (err: any) {
          erros++;
          console.warn(`      ⚠️ ${err.message}`);
        }
      }
    }

    console.log(`\n✅ CONCLUÍDO\n`);

    return NextResponse.json({
      sucesso: true,
      resumo: {
        produtosProcessados: produtos.length,
        variadasCriadas: variadasCriadas,
        erros: erros
      }
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}
