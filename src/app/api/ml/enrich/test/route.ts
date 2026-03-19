import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * ENDPOINT DE TESTE: Enriquecer produto com detalhes do ML
 * GET /api/ml/enrich/test?mlListingId=MLB0000000025
 * 
 * Objetivo: Pegar detalhes de UM produto do ML e mapear para campos do Product
 * 
 * DEPARA (Mapping) ML → Aplicação:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ CAMPO DO ML              → CAMPO DA APP        │ TIPO           │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ id                       → mlListingId         │ String         │
 * │ title                    → name                │ String         │
 * │ description.plain_text   → description         │ Text           │
 * │ price                    → baseSalePrice       │ Float          │
 * │ currency_id              → (validar)           │ String         │
 * │ inventory.quantity       → minStock            │ Int            │
 * │ status                   → active              │ Boolean        │
 * │ pictures[0].url          → (criar como img?)   │ Image/Media    │
 * │ category_id              → categoryId          │ String?        │
 * │ seller_id                → (info)              │ String?        │
 * └─────────────────────────────────────────────────────────────────┘
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
  seller_id?: string;
}

interface MappingResult {
  mlListingId: string;
  mapping: {
    name: string;
    description: string;
    baseSalePrice: number;
    minStock: number;
    active: boolean;
    currency: string;
    imageUrl: string | null;
    categoryId: string | null;
  };
  validation: {
    campos_obrigatorios_ok: boolean;
    campos_faltantes: string[];
    avisos: string[];
  };
}

/**
 * Mock: Simular fetch do produto ML
 * Em produção, isso viria de https://api.mercadolivre.com/items/{id}
 */
function getMockMLProduct(mlListingId: string): MLProductResponse {
  return {
    id: mlListingId,
    title: 'Transformador 12V 5A - Produto teste',
    price: 199.90,
    currency_id: 'BRL',
    status: 'active',
    description: {
      plain_text: 'Transformador 12V 5A com alta eficiência - Ideal para eletrônicos'
    },
    inventory: {
      quantity: 12
    },
    pictures: [
      {
        id: 'pic_1',
        url: 'https://example.com/transformador-12v-5a.jpg'
      }
    ],
    category_id: 'MLB262711',
    seller_id: '267571726'
  };
}

/**
 * Mapear produto ML para estrutura da App
 */
function mapMLProductToApp(mlProduct: MLProductResponse): MappingResult {
  const faltantes: string[] = [];
  const avisos: string[] = [];

  // Validar campos obrigatórios
  if (!mlProduct.id) faltantes.push('id (mlListingId)');
  if (!mlProduct.title) faltantes.push('title (name)');
  if (mlProduct.price === undefined) faltantes.push('price (baseSalePrice)');

  // Avisos para campos opcionais
  if (!mlProduct.description?.plain_text) {
    avisos.push('Descrição vazia - usando título como fallback');
  }
  if (!mlProduct.inventory?.quantity) {
    avisos.push('Quantidade não informada - usando 5 como padrão');
  }
  if (!mlProduct.pictures?.length) {
    avisos.push('Nenhuma imagem disponível');
  }

  return {
    mlListingId: mlProduct.id,
    mapping: {
      // Campos obrigatórios
      name: mlProduct.title || 'Produto sem nome',
      description: mlProduct.description?.plain_text || mlProduct.title || 'Sem descrição',
      baseSalePrice: mlProduct.price || 0,
      minStock: mlProduct.inventory?.quantity || 5,
      active: mlProduct.status === 'active',
      
      // Campos adicionais
      currency: mlProduct.currency_id || 'BRL',
      imageUrl: mlProduct.pictures?.[0]?.url || null,
      categoryId: mlProduct.category_id || null
    },
    validation: {
      campos_obrigatorios_ok: faltantes.length === 0,
      campos_faltantes: faltantes,
      avisos: avisos
    }
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mlListingId = searchParams.get('mlListingId');

    if (!mlListingId) {
      return NextResponse.json({
        error: 'Parâmetro mlListingId obrigatório',
        exemplo: GET.toString().includes('?') ? 'ver código' : '/api/ml/enrich/test?mlListingId=MLB0000000025'
      }, { status: 400 });
    }

    // 1. Buscar produto no banco para validar que existe
    const produtoExistente = await prisma.product.findFirst({
      where: { mlListingId }
    });

    if (!produtoExistente) {
      return NextResponse.json({
        error: 'Produto não encontrado no banco',
        mlListingId
      }, { status: 404 });
    }

    // 2. Simular fetch dos detalhes do ML (em produção seria chamada real)
    const mlProduct = getMockMLProduct(mlListingId);

    // 3. Mapear campos ML → App
    const mapping = mapMLProductToApp(mlProduct);

    // 4. Mostrar o que seria salvo
    return NextResponse.json({
      sucesso: true,
      teste: true,
      produto_atual: {
        id: produtoExistente.id,
        nome: produtoExistente.name,
        preco: produtoExistente.baseSalePrice,
        estoque_minimo: produtoExistente.minStock,
        ativo: produtoExistente.active
      },
      ml_produto_detalhes: {
        id: mlProduct.id,
        titulo: mlProduct.title,
        preco: mlProduct.price,
        quantidade: mlProduct.inventory?.quantity,
        status: mlProduct.status,
        descricao: mlProduct.description?.plain_text?.substring(0, 100) + '...',
        imagem: mlProduct.pictures?.[0]?.url
      },
      mapeamento: mapping,
      preview_atualizacao: {
        seria_atualizado: {
          nome: mapping.mapping.name,
          descricao: mapping.mapping.description.substring(0, 50) + '...',
          baseSalePrice: mapping.mapping.baseSalePrice,
          minStock: mapping.mapping.minStock,
          active: mapping.mapping.active,
          baseMLPrice: mapping.mapping.baseSalePrice // Pode ser diferente do baseSalePrice
        },
        avisos_validacao: mapping.validation.avisos
      },
      proximos_passos: [
        '1. Review os dados acima',
        '2. Chamar POST /api/ml/enrich/apply para salvar',
        '3. Rodar para todos os produtos'
      ]
    });

  } catch (error: any) {
    return NextResponse.json(
      { 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
