import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { put } from "@vercel/blob"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { getMLIntegrationForTenant } from "@/lib/ml"

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
    picture_ids?: string[]
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
    const tenantId = await getTenantIdOrDefault()
    const integration = await getMLIntegrationForTenant(tenantId)
    if (!integration) {
      return NextResponse.json(
        {
          error: "Integração com Mercado Livre não configurada",
          stats: { total: 0, synced: 0, failed: 0 },
        },
        { status: 400 }
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

        // Se não existe, criar (tenantId vem do escopo do endpoint)
        if (!product) {
          product = await prisma.product.create({
            data: {
              name: productTitle,
              description: mlProduct.description || "",
              baseSalePrice: productPrice,
              minStock: 0,
              mlListingId: mlProduct.id,
              tenantId,
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

            // Importar imagens da variação a partir dos picture_ids
            if (variation.picture_ids && Array.isArray(variation.picture_ids) && variation.picture_ids.length > 0) {
              try {
                const existingVariantImages = await prisma.variantImage.findMany({
                  where: { variantId: variant.id }
                })

                // Processar imagens em paralelo
                await Promise.all(
                  variation.picture_ids.map(async (pictureId: string, imageIndex: number) => {
                    try {
                      // Buscar detalhes da imagem do ML
                      const pictureResponse = await fetch(
                        `https://api.mercadolibre.com/pictures/${pictureId}`,
                        {
                          headers: {
                            Authorization: `Bearer ${integration.accessToken}`
                          }
                        }
                      )

                      if (!pictureResponse.ok) {
                        console.warn(`[ML/SYNC] Erro ao buscar imagem ${pictureId}`)
                        return
                      }

                      const pictureData = await pictureResponse.json()
                      const imageUrl = pictureData.secure_url || pictureData.url

                      if (!imageUrl) {
                        console.warn(`[ML/SYNC] URL não encontrada para imagem ${pictureId}`)
                        return
                      }

                      // Verificar se já existe
                      const alreadyExists = existingVariantImages.some(img => img.mlUrl === imageUrl)
                      if (alreadyExists) {
                        return // Skip
                      }

                      // Baixar imagem
                      const imageResponse = await fetch(imageUrl)
                      if (!imageResponse.ok) {
                        console.warn(`[ML/SYNC] Erro ao baixar imagem ${imageUrl}`)
                        return
                      }

                      const imageBuffer = await imageResponse.arrayBuffer()
                      const filename = `variants/${variant.id}/ml-${pictureId}.jpg`

                      // Upload no Vercel Blob
                      const blob = await put(filename, imageBuffer, {
                        access: "public",
                        contentType: "image/jpeg"
                      })

                      // Salvar no banco
                      await prisma.variantImage.create({
                        data: {
                          variantId: variant.id,
                          url: blob.url,
                          mlUrl: imageUrl,
                          order: imageIndex
                        }
                      })

                      console.log(`[ML/SYNC] Imagem ${pictureId} importada para variação ${variant.id}`)
                    } catch (imageError) {
                      console.warn(`[ML/SYNC] Erro ao importar imagem ${pictureId} da variação:`, imageError)
                    }
                  })
                )
              } catch (variantImagesError) {
                console.warn(`[ML/SYNC] Erro ao processar imagens da variação ${variant.id}:`, variantImagesError)
                // Continua mesmo se falhar nas imagens
              }
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

          // Importar imagens do produto padrão (quando não há variações)
          if (mlProduct.pictures && Array.isArray(mlProduct.pictures) && mlProduct.pictures.length > 0) {
            try {
              const existingVariantImages = await prisma.variantImage.findMany({
                where: { variantId: defaultVariant.id }
              })

              // Importar apenas imagens que ainda não existem
              await Promise.all(
                mlProduct.pictures.map(async (picture, imageIndex) => {
                  try {
                    const pictureUrl = picture.url
                    const alreadyExists = existingVariantImages.some(img => img.mlUrl === pictureUrl)

                    if (alreadyExists) {
                      return // Skip
                    }

                    // Baixar imagem
                    const imageResponse = await fetch(pictureUrl)
                    if (!imageResponse.ok) {
                      console.warn(`[ML/SYNC] Erro ao baixar imagem padrão: ${pictureUrl}`)
                      return
                    }

                    const imageBuffer = await imageResponse.arrayBuffer()
                    const filename = `variants/${defaultVariant.id}/ml-${Date.now()}-${imageIndex}.jpg`

                    // Upload no Blob
                    const blob = await put(filename, imageBuffer, {
                      access: "public",
                      contentType: "image/jpeg"
                    })

                    // Salvar no banco
                    await prisma.variantImage.create({
                      data: {
                        variantId: defaultVariant.id,
                        url: blob.url,
                        mlUrl: pictureUrl,
                        order: imageIndex
                      }
                    })

                    console.log(`[ML/SYNC] Imagem padrão importada para variação ${defaultVariant.id}`)
                  } catch (imageError) {
                    console.warn(`[ML/SYNC] Erro ao importar imagem padrão:`, imageError)
                  }
                })
              )
            } catch (defaultImagesError) {
              console.warn(`[ML/SYNC] Erro ao processar imagens da variação padrão ${defaultVariant.id}:`, defaultImagesError)
              // Continua mesmo se falhar nas imagens
            }
          }

          variantsCount = 1
        }

        // Importar imagens do ML para o Blob
        if (mlProduct.pictures && Array.isArray(mlProduct.pictures) && mlProduct.pictures.length > 0) {
          try {
            const existingImages = await prisma.productImage.findMany({
              where: { productId: product.id }
            })

            // Importar apenas imagens que ainda não existem
            await Promise.all(
              mlProduct.pictures.map(async (picture, index) => {
                try {
                  const pictureUrl = picture.url
                  const alreadyExists = existingImages.some(img => img.mlUrl === pictureUrl)

                  if (alreadyExists) {
                    return // Skip
                  }

                  // Baixar imagem
                  const imageResponse = await fetch(pictureUrl)
                  if (!imageResponse.ok) {
                    console.warn(`[ML/SYNC] Erro ao baixar imagem: ${pictureUrl}`)
                    return
                  }

                  const imageBuffer = await imageResponse.arrayBuffer()
                  const filename = `products/${product.id}/ml-${Date.now()}-${index}.jpg`

                  // Upload no Blob
                  const blob = await put(filename, imageBuffer, {
                    access: "public",
                    contentType: "image/jpeg"
                  })

                  // Salvar no banco
                  await prisma.productImage.create({
                    data: {
                      productId: product.id,
                      url: blob.url,
                      mlUrl: pictureUrl,
                      order: index
                    }
                  })
                } catch (imageError) {
                  console.warn(`[ML/SYNC] Erro ao importar imagem individual:`, imageError)
                }
              })
            )
          } catch (imagesError) {
            console.warn(`[ML/SYNC] Erro ao processar imagens do produto ${product.id}:`, imagesError)
            // Continua mesmo se falhar nas imagens
          }
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
