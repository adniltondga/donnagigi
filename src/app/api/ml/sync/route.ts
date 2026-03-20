import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

interface MLProduct {
  id: string
  title: string | null
  name: string | null
  displayName?: string
  price: number
  currency_id: string
  available_quantity: number
  variations?: Array<{
    id: string
    attribute_combinations?: Array<{
      name: string
      value_name: string
    }>
    price?: number
    available_quantity?: number
    sold_quantity?: number
  }>
  pictures?: Array<{
    url: string
  }>
  description?: string
  stock?: number
  catalog_product_id?: string | null
  listing_type_id?: string
}

export async function GET() {
  try {
    // 1. Verificar se tem integração OAuth2
    const integration = await prisma.mLIntegration.findFirst()
    if (!integration) {
      return NextResponse.json(
        {
          error: "Integração com Mercado Livre não configurada",
          stats: { total: 0, synced: 0, failed: 0 },
        },
        { status: 400 }
      )
    }

    // 2. Checar se token não expirou
    if (new Date() > integration.expiresAt) {
      return NextResponse.json(
        {
          error: "Token de integração expirado. Reconecte sua conta.",
          stats: { total: 0, synced: 0, failed: 0 },
        },
        { status: 401 }
      )
    }

    // 3. Buscar produtos reais do usuário usando /users/{id}/items/search
    // Endpoint que funciona mesmo com scopes limitados
    console.log("[ML/SYNC] Buscando produtos reais para seller:", integration.sellerID)

    let mlProducts: MLProduct[] = []
    try {
      // GET /users/{id}/items/search - funciona mesmo com scopes limitados
      const mlResponse = await fetch(
        `https://api.mercadolibre.com/users/${integration.sellerID}/items/search?limit=25`,
        {
          headers: {
            Authorization: `Bearer ${integration.accessToken}`,
          },
        }
      )

      if (!mlResponse.ok) {
        const errorData = await mlResponse.json().catch(() => ({}))
        console.error("[ML/SYNC] Erro ao buscar /users/{id}/items/search:", {
          status: mlResponse.status,
          statusText: mlResponse.statusText,
          errorData,
        })
        throw new Error(
          `Erro ao buscar produtos: ${mlResponse.statusText}. ${
            errorData.message || errorData.error || "Verifique se o token tem permissões."
          }`
        )
      }

      const searchResults = await mlResponse.json()
      // results é um array de strings (IDs), não de objetos!
      const listingIds = searchResults.results || []
      console.log("[ML/SYNC] Produtos encontrados:", listingIds.length)

      // 4. Buscar detalhes dos produtos em batch usando /items?ids=...
      // A API retorna formato especial: [{code: 200, body: {...}}]
      for (let i = 0; i < listingIds.length; i += 20) {
        const batch = listingIds.slice(i, i + 20)
        const idsParam = batch.join(",")

        try {
          const productResponse = await fetch(
            `https://api.mercadolibre.com/items?ids=${idsParam}`,
            {
              headers: {
                Authorization: `Bearer ${integration.accessToken}`,
              },
            }
          )

          if (productResponse.ok) {
            const products = await productResponse.json()
            // Desembrulhar formato especial {code: 200, body: {...}}
            const unwrapped = products
              .filter((p: any) => p.code === 200 && p.body)
              .map((p: any) => p.body)
            mlProducts.push(...unwrapped)
            console.log("[ML/SYNC] Detalhes obtidos para batch:", unwrapped.length)
          }
        } catch (e) {
          console.error(`[ML/SYNC] Erro ao buscar batch de produtos:`, e)
        }
      }
    } catch (error) {
      console.error("[ML/SYNC] Erro ao buscar produtos do ML:", error)
      return NextResponse.json(
        {
          error: `Erro ao buscar produtos do Mercado Livre: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
          stats: { total: 0, synced: 0, failed: 0 },
        },
        { status: 400 }
      )
    }

    // 5. Importar batch de produtos
    console.log("[ML/SYNC] Começando importação de", mlProducts.length, "produtos")

    const results: any[] = []
    let synced = 0
    let failed = 0

    for (const mlProduct of mlProducts) {
      try {
        const productTitle = mlProduct.title || mlProduct.displayName || mlProduct.name || "Sem título"
        const productPrice = mlProduct.price || 0
        const stock = mlProduct.available_quantity || 0

        // Verificar se produto já existe
        let product = await prisma.product.findUnique({
          where: { mlListingId: mlProduct.id },
        })

        // Se não existe, criar
        if (!product) {
          product = await prisma.product.create({
            data: {
              name: productTitle,
              description: mlProduct.description || "",
              baseSalePrice: productPrice,
              minStock: 0,
              mlListingId: mlProduct.id,
            },
          })
        }

        // Importar variações
        let variantsCount = 0
        if (mlProduct.variations && Array.isArray(mlProduct.variations)) {
          for (const variation of mlProduct.variations) {
            // Criar atributos da variação
            const attributes = variation.attribute_combinations
              ? variation.attribute_combinations.map((attr) => `${attr.name}:${attr.value_name}`).join(", ")
              : "Padrão"

            let variant = await prisma.productVariant.findFirst({
              where: {
                productId: product.id,
                cod: `${product.id}-var-${variation.id}`,
              },
            })

            if (!variant) {
              variant = await prisma.productVariant.create({
                data: {
                  productId: product.id,
                  cod: `${product.id}-var-${variation.id}`,
                  title: attributes,
                  salePrice: variation.price || productPrice,
                  stock: variation.available_quantity || 0,
                  mlListingId: variation.id.toString(),
                },
              })

              // Criar referência em MLProduct se ainda não existe
              await prisma.mLProduct.create({
                data: {
                  variantId: variant.id,
                  integrationId: integration.id,
                  mlListingId: mlProduct.id,
                  status: "active",
                },
              })
            } else {
              // Atualizar estoque
              await prisma.productVariant.update({
                where: { id: variant.id },
                data: {
                  salePrice: variation.price || productPrice,
                  stock: variation.available_quantity || 0,
                },
              })
            }
            variantsCount++
          }
        } else {
          // Sem variações, criar uma única variação "padrão"
          let defaultVariant = await prisma.productVariant.findFirst({
            where: {
              productId: product.id,
              cod: product.id,
            },
          })

          if (!defaultVariant) {
            defaultVariant = await prisma.productVariant.create({
              data: {
                productId: product.id,
                cod: product.id,
                title: "Padrão",
                salePrice: productPrice,
                stock,
                mlListingId: mlProduct.id,
              },
            })

            // Criar referência em MLProduct
            await prisma.mLProduct.create({
              data: {
                variantId: defaultVariant.id,
                integrationId: integration.id,
                mlListingId: mlProduct.id,
                status: "active",
              },
            })
          } else {
            await prisma.productVariant.update({
              where: { id: defaultVariant.id },
              data: {
                salePrice: productPrice,
                stock,
              },
            })
          }
          variantsCount = 1
        }

        results.push({
          id: product.id,
          name: productTitle,
          price: productPrice,
          variants: variantsCount,
        })
        synced++
      } catch (error) {
        console.error(`[ML/SYNC] Erro ao importar produto:`, error)
        failed++
      }
    }

    console.log("[ML/SYNC] Importação concluída:", {
      total: mlProducts.length,
      synced,
      failed,
    })

    return NextResponse.json({
      message: `Sincronização completa: ${synced} produtos importados com sucesso`,
      stats: {
        total: mlProducts.length,
        synced,
        failed,
      },
      data: synced > 0 ? results : [],
    })
  } catch (error) {
    console.error("[ML/SYNC] Erro geral:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro desconhecido",
        stats: { total: 0, synced: 0, failed: 0 },
      },
      { status: 500 }
    )
  }
}
