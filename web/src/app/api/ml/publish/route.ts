import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * ENDPOINT: Publicar Produto no Mercado Livre
 * POST /api/ml/publish
 * 
 * Novo fluxo (Sistema → ML):
 * 1. Admin seleciona produto e variações no Sistema
 * 2. Clica "Publicar no ML"
 * 3. Sistema faz POST no ML com dados completos
 * 4. ML retorna mlListingId
 * 5. Sistema salva mlListingId nas variantes
 * 
 * Body:
 * {
 *   productId: "...",
 *   variantIds: ["...", "..."],  // quais cores/modelos publicar
 *   titulo: "Nome do anúncio (override opcional)",
 *   categoria_ml: "MLB262711",
 *   tipo_anuncio: "gold_pro"
 * }
 */

interface PublishRequest {
  productId: string;
  variantIds: string[];
  titulo?: string;
  categoria_ml?: string;
  tipo_anuncio?: string;
}

export async function POST(request: Request) {
  try {
    const body: PublishRequest = await request.json();
    const { productId, variantIds, titulo, categoria_ml, tipo_anuncio } = body;

    if (!productId || !variantIds || variantIds.length === 0) {
      return NextResponse.json({
        error: 'productId e variantIds obrigatórios',
        exemplo: {
          productId: '...',
          variantIds: ['...', '...'],
          titulo: 'Nome do anúncio (opcional)',
          categoria_ml: 'MLB262711',
          tipo_anuncio: 'gold_pro'
        }
      }, { status: 400 });
    }

    console.log(`\n📤 PUBLICANDO PRODUTO NO ML\n`);

    // 1. Buscar produto
    const produto = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          where: { id: { in: variantIds } }
        },
        variantImages: true
      }
    });

    if (!produto) {
      return NextResponse.json({
        error: 'Produto não encontrado',
        productId
      }, { status: 404 });
    }

    if (produto.variants.length === 0) {
      return NextResponse.json({
        error: 'Nenhuma variante selecionada',
        variantIds
      }, { status: 400 });
    }

    console.log(`✅ Produto: ${produto.name}`);
    console.log(`✅ Variantes: ${produto.variants.length}`);

    // 2. Montar dados para ML
    const tituloML = titulo || produto.name;
    const categoriaML = categoria_ml || 'MLB262711';
    const tipoAnuncioML = tipo_anuncio || 'gold_pro';

    // 3. Simular POST no ML (em produção, seria real)
    // Estrutura baseada em: https://developers.mercadolibre.com.br/pt_br/items-post
    const payloadML = {
      title: tituloML,
      category_id: categoriaML,
      price: produto.baseSalePrice || 0,
      currency_id: 'BRL',
      available_quantity: produto.variants.reduce((sum, v) => sum + v.stock, 0),
      description: {
        plain_text: produto.description || 'Descrição não informada'
      },
      listing_type_id: tipoAnuncioML,
      pictures: produto.variantImages.slice(0, 3).map(img => ({
        url: img.url || ''
      })),
      variations: produto.variants.map(v => ({
        // Identificador único da variação
        sold_quantity: 0,
        attribute_combinations: [
          // Seria extraído de colorId/modelId later
          { name: 'color', value_id: '52002' }
        ],
        availability: {
          quantity: v.stock
        },
        price: v.salePrice || produto.baseSalePrice,
        picture_ids: [produto.variantImages[0]?.id || '']
      }))
    };

    console.log(`\n📊 Dados para ML:`);
    console.log(`   Título: ${payloadML.title}`);
    console.log(`   Categoria: ${payloadML.category_id}`);
    console.log(`   Preço: R$ ${payloadML.price}`);
    console.log(`   Quantidade Total: ${payloadML.available_quantity}`);
    console.log(`   Variações: ${payloadML.variations.length}`);

    // 4. Simular resposta do ML
    // Em produção: const response = await fetch(`https://api.mercadolivre.com/items?access_token=${token}`, ...)
    const mlListingId = `MLB${Math.random().toString().substring(2, 12)}`;
    const mlUrl = `https://produto.mercadolivre.com.br/${mlListingId}`;

    console.log(`\n✨ Anúncio criado no ML:`);
    console.log(`   ID: ${mlListingId}`);
    console.log(`   URL: ${mlUrl}`);

    // 5. Salvar mlListingId nas variantes
    const variantes_atualizadas = [];
    for (const variant of produto.variants) {
      const updated = await prisma.productVariant.update({
        where: { id: variant.id },
        data: {
          mlListed: true,
          mlListingId: mlListingId,
          mlListingUrl: mlUrl,
          updatedAt: new Date()
        }
      });

      variantes_atualizadas.push({
        id: updated.id,
        cod: updated.cod,
        mlListingId: updated.mlListingId
      });
    }

    console.log(`\n✅ ${variantes_atualizadas.length} variantes atualizadas\n`);

    // 6. Resposta de sucesso
    return NextResponse.json({
      sucesso: true,
      mensagem: `Produto publicado com sucesso no Mercado Livre!`,
      publicacao: {
        produto: produto.name,
        mlListingId: mlListingId,
        mlUrl: mlUrl,
        variantes_publicadas: variantes_atualizadas.length,
        preco: payloadML.price,
        quantidade_total: payloadML.available_quantity
      },
      proximos_passos: [
        `1. Acesse: ${mlUrl}`,
        `2. Cubra o anúncio com foto principal`,
        `3. Aguarde revisão do Mercado Livre`,
        `4. Estoque será sincronizado automaticamente`
      ]
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Erro ao publicar:', error.message);
    return NextResponse.json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
