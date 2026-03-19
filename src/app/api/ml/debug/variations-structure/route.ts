import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * DEBUG: Visualizar estrutura de variações do Mercado Livre
 * GET /api/ml/debug/variations-structure
 * 
 * O ML retorna variações quando o produto tem múltiplas opções:
 * - Cores
 * - Tamanhos
 * - Modelos
 * - Etc.
 * 
 * Estrutura:
 * {
 *   "id": "MLB...",
 *   "title": "Produto com cores",
 *   "variations": [
 *     {
 *       "id": "VAR123",
 *       "attribute_combinations": [
 *         { "name": "color", "value": "Preto" }
 *       ],
 *       "price": 100,
 *       "available_quantity": 5,
 *       "picture_ids": ["pic1"]
 *     },
 *     {
 *       "id": "VAR124",
 *       "attribute_combinations": [
 *         { "name": "color", "value": "Branco" }
 *       ],
 *       "price": 100,
 *       "available_quantity": 8,
 *       "picture_ids": ["pic2"]
 *     }
 *   ]
 * }
 */

export async function GET() {
  return NextResponse.json({
    sucesso: true,
    estrutura_ml: {
      exemplo_produto_com_variacoes: {
        id: "MLB1234567890",
        title: "Capinha iPhone 14 Pro - Multi Cores",
        variations: [
          {
            id: "MLB1234567890-VAR1",
            attribute_combinations: [
              { name: "color", value: "Preto" }
            ],
            price: 99.90,
            available_quantity: 5,
            picture_ids: ["pic_1"]
          },
          {
            id: "MLB1234567890-VAR2",
            attribute_combinations: [
              { name: "color", value: "Branco" }
            ],
            price: 99.90,
            available_quantity: 8,
            picture_ids: ["pic_2"]
          },
          {
            id: "MLB1234567890-VAR3",
            attribute_combinations: [
              { name: "color", value: "Azul" }
            ],
            price: 99.90,
            available_quantity: 3,
            picture_ids: ["pic_3"]
          }
        ]
      }
    },
    mapeamento_app: {
      product_base: {
        name: "title",
        description: "description.plain_text",
        baseSalePrice: "variations[0].price",
        minStock: "sum(variations.available_quantity)"
      },
      product_variants: {
        por_cada_variation: {
          cod: "variation.id",
          salePrice: "variation.price",
          stock: "variation.available_quantity",
          color_ou_modelo: "variation.attribute_combinations[0].value"
        }
      }
    },
    problema_atual: {
      descricao: "Sync atual cria APENAS Product base, não cria ProductVariant",
      consequencia: "Produtos com 1 variação mostram como sem variações no sistema",
      solucao: "Extrair variations do ML e criar ProductVariant para cada uma"
    },
    proximos_passos: [
      "1. Criar endpoint que lista variações de um produto MLB",
      "2. Modificar /api/ml/sync para processar variations",
      "3. Para cada variation, criar ProductVariant",
      "4. Testar com produto que tem múltiplas cores/modelos"
    ]
  });
}
