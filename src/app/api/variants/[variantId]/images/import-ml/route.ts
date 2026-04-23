import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { put } from "@vercel/blob"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { getMLIntegrationForTenant } from "@/lib/ml"

export async function POST(
  _request: NextRequest,
  { params }: { params: { variantId: string } }
) {
  try {
    const tenantId = await getTenantIdOrDefault()

    // Buscar variação (garantindo que pertence ao tenant via product)
    const variant = await prisma.productVariant.findFirst({
      where: { id: params.variantId, product: { tenantId } },
      include: { product: true }
    })

    if (!variant) {
      return NextResponse.json(
        { error: "Variação não encontrada" },
        { status: 404 }
      )
    }

    if (!variant.mlListingId) {
      console.log(`[IMPORT-ML] Variante ${params.variantId} sem mlListingId`)
      return NextResponse.json(
        { error: "Variação não tem mlListingId", variantId: params.variantId },
        { status: 400 }
      )
    }

    console.log(`[IMPORT-ML] Variante encontrada: mlListingId=${variant.mlListingId}, productId=${variant.productId}`)

    // Buscar integração ML (escopo tenant)
    const integration = await getMLIntegrationForTenant(tenantId)

    if (!integration) {
      return NextResponse.json(
        { error: "Integração com ML não configurada" },
        { status: 400 }
      )
    }

    // Buscar MLProduct para obter o mlListingId do item pai
    const mlProduct = await prisma.mLProduct.findFirst({
      where: { variantId: params.variantId }
    })

    if (!mlProduct) {
      return NextResponse.json(
        { error: "Produto ML não encontrado para esta variação" },
        { status: 404 }
      )
    }

    // Buscar item completo do ML
    const itemResponse = await fetch(
      `https://api.mercadolibre.com/items/${mlProduct.mlListingId}`,
      {
        headers: {
          Authorization: `Bearer ${integration.accessToken}`
        }
      }
    )

    if (!itemResponse.ok) {
      const errData = await itemResponse.text()
      console.log(`[IMPORT-ML] Erro ao buscar item: ${itemResponse.status} ${errData}`)
      return NextResponse.json(
        { error: "Erro ao buscar item no ML", status: itemResponse.status },
        { status: itemResponse.status }
      )
    }

    const mlItem = await itemResponse.json()
    console.log(`[IMPORT-ML] Item buscado: ${mlProduct.mlListingId}, tem ${mlItem.pictures?.length || 0} pictures`)

    console.log(`[IMPORT-ML] Buscando imagens para variação ${variant.mlListingId}`)
    console.log(`[IMPORT-ML] Item tem ${mlItem.variations?.length || 0} variações`)

    // Encontrar a variação específica no ML
    const mlVariation = mlItem.variations?.find(
      (v: any) => v.id.toString() === variant.mlListingId
    )

    // Se não encontrou a variação específica, usar as imagens do item principal
    let pictureIds: string[] = []

    if (mlVariation && mlVariation.picture_ids) {
      console.log(`[IMPORT-ML] Variação encontrada com ${mlVariation.picture_ids.length} imagens`)
      pictureIds = mlVariation.picture_ids
    } else if (mlItem.pictures && Array.isArray(mlItem.pictures)) {
      // Fallback: usar imagens do item principal
      console.log(`[IMPORT-ML] Variação não tem imagens, usando imagens do item (${mlItem.pictures.length})`)
      pictureIds = mlItem.pictures.map((p: any) => p.id)
    } else {
      console.log(`[IMPORT-ML] Nenhuma imagem encontrada`)
      return NextResponse.json({
        imported: 0,
        message: "Variação do ML não tem imagens"
      })
    }

    // Processar imagens em paralelo
    const importedImages = await Promise.all(
      pictureIds.map(async (pictureId: string, index: number) => {
        try {
          // Buscar URL da imagem
          const pictureResponse = await fetch(
            `https://api.mercadolibre.com/pictures/${pictureId}`,
            {
              headers: {
                Authorization: `Bearer ${integration.accessToken}`
              }
            }
          )

          if (!pictureResponse.ok) {
            console.warn(`Erro ao buscar imagem ${pictureId}`)
            return null
          }

          const pictureData = await pictureResponse.json()
          const imageUrl = pictureData.secure_url || pictureData.url

          if (!imageUrl) {
            console.warn(`URL não encontrada para imagem ${pictureId}`)
            return null
          }

          // Verificar se já existe
          const existing = await prisma.variantImage.findFirst({
            where: {
              variantId: params.variantId,
              mlUrl: imageUrl
            }
          })

          if (existing) {
            return null // Skip se já existe
          }

          // Baixar imagem
          const imageResponse = await fetch(imageUrl)

          if (!imageResponse.ok) {
            console.warn(`Erro ao baixar imagem ${imageUrl}`)
            return null
          }

          const imageBuffer = await imageResponse.arrayBuffer()
          const filename = `variants/${params.variantId}/ml-${pictureId}.jpg`

          // Upload no Vercel Blob
          const blob = await put(filename, imageBuffer, {
            access: "public",
            contentType: "image/jpeg"
          })

          // Salvar no banco
          const image = await prisma.variantImage.create({
            data: {
              variantId: params.variantId,
              url: blob.url,
              mlUrl: imageUrl,
              order: index
            }
          })

          return image
        } catch (error) {
          console.error(`Erro ao importar imagem ${pictureId}:`, error)
          return null
        }
      })
    )

    const successfulImports = importedImages.filter((img) => img !== null)

    return NextResponse.json({
      imported: successfulImports.length,
      total: pictureIds.length,
      images: successfulImports
    })
  } catch (error) {
    console.error("Error importing ML variant images:", error)
    return NextResponse.json(
      { error: "Erro ao importar imagens do ML" },
      { status: 500 }
    )
  }
}
