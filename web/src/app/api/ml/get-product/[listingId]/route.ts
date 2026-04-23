import { NextResponse } from "next/server"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { getMLIntegrationForTenant } from "@/lib/ml"

export const dynamic = "force-dynamic"

/**
 * Buscar detalhes completos de um produto do Mercado Livre
 * GET /api/ml/get-product/[listingId]
 * 
 * Retorna:
 * - Informações completas do produto
 * - Variações (se houver)
 * - Imagens
 * - Descrição
 */

export async function GET(
  _request: Request,
  { params }: { params: { listingId: string } }
) {
  try {
    const { listingId } = params

    if (!listingId) {
      return NextResponse.json({
        error: "listingId é obrigatório"
      }, { status: 400 })
    }

    // 1️⃣ Buscar integração ML (escopo tenant)
    const tenantId = await getTenantIdOrDefault()
    const mlIntegration = await getMLIntegrationForTenant(tenantId)

    if (!mlIntegration) {
      return NextResponse.json({
        error: "MLIntegration não configurada"
      }, { status: 400 })
    }

    // 2️⃣ Chamar API do ML para buscar detalhes
    const mlUrl = `https://api.mercadolibre.com/items/${listingId}`

    console.log("📡 Buscando detalhes do produto:", mlUrl)

    const mlResponse = await fetch(mlUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${mlIntegration.accessToken}`,
        "Content-Type": "application/json"
      }
    })

    if (!mlResponse.ok) {
      const error = await mlResponse.text()
      console.error("❌ Erro ao buscar produto:", error)
      
      return NextResponse.json({
        error: "Erro ao buscar produto do ML",
        statusCode: mlResponse.status
      }, { status: mlResponse.status })
    }

    const product = await mlResponse.json()

    // 4️⃣ Extrair variações se existirem
    let variations = []
    if (product.variations && product.variations.length > 0) {
      variations = product.variations.map((v: any) => ({
        id: v.id,
        attributes: v.attribute_combinations || [],
        price: v.price,
        quantity: v.quantity,
        seller_sku: v.seller_sku
      }))
    }

    // 5️⃣ Estruturar resposta
    return NextResponse.json({
      success: true,
      produto: {
        id: product.id,
        title: product.title,
        price: product.price,
        currency_id: product.currency_id,
        available_quantity: product.available_quantity,
        status: product.status,
        category_id: product.category_id,
        pictures: product.pictures?.map((p: any) => ({
          id: p.id,
          url: p.secure_url || p.url
        })) || [],
        description: product.description,
      },
      variações: {
        total: variations.length,
        dados: variations.length > 0 ? variations : "Produto sem variações (será criado como variante única)"
      },
      mapeamento_para_nosso_sistema: {
        "Product.mlListingId": product.id,
        "Product.name": product.title,
        "Product.description": product.description || "", 
        "Product.baseSalePrice": product.price,
        "ProductVariant[]": variations.length > 0 
          ? `${variations.length} variações (cod + title + price + quantity)`
          : "1 variante (sem variações, usamos o produto como variante única)"
      },
      proximos_passos: [
        "✅ Revise a estrutura acima",
        "📝 Confirme se quer importar este produto",
        "💾 Chamar POST /api/ml/import-product para inserir no banco"
      ]
    })

  } catch (error) {
    console.error("Erro:", error)
    return NextResponse.json({
      error: "Erro ao buscar detalhes",
      message: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 })
  }
}
