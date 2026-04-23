import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { put } from "@vercel/blob"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { getMLIntegrationForTenant } from "@/lib/ml"
import { AuthError, authErrorResponse, requireRole } from "@/lib/auth"

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['OWNER', 'ADMIN'])
    const tenantId = await getTenantIdOrDefault()

    // Buscar produto (escopo tenant)
    const product = await prisma.product.findFirst({
      where: { id: params.id, tenantId }
    })

    if (!product) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      )
    }

    if (!product.mlListingId) {
      return NextResponse.json(
        { error: "Produto não tem mlListingId" },
        { status: 400 }
      )
    }

    // Buscar integração ML (escopo tenant)
    const integration = await getMLIntegrationForTenant(tenantId)

    if (!integration) {
      return NextResponse.json(
        { error: "Integração com ML não configurada" },
        { status: 400 }
      )
    }

    // Buscar produto no ML
    const mlResponse = await fetch(
      `https://api.mercadolibre.com/items/${product.mlListingId}`,
      {
        headers: {
          Authorization: `Bearer ${integration.accessToken}`
        }
      }
    )

    if (!mlResponse.ok) {
      return NextResponse.json(
        { error: "Erro ao buscar produto no ML" },
        { status: mlResponse.status }
      )
    }

    const mlProduct = await mlResponse.json()

    if (!mlProduct.pictures || mlProduct.pictures.length === 0) {
      return NextResponse.json({
        imported: 0,
        message: "Produto do ML não tem imagens"
      })
    }

    // Processar imagens em paralelo
    const importedImages = await Promise.all(
      mlProduct.pictures.map(async (picture: any, index: number) => {
        try {
          // Verificar se já existe
          const existing = await prisma.productImage.findFirst({
            where: {
              productId: params.id,
              mlUrl: picture.secure_url || picture.url
            }
          })

          if (existing) {
            return null // Skip se já existe
          }

          // Baixar imagem do ML
          const imageUrl = picture.secure_url || picture.url
          const imageResponse = await fetch(imageUrl)

          if (!imageResponse.ok) {
            console.error(`Erro ao baixar imagem ${imageUrl}`)
            return null
          }

          const imageBuffer = await imageResponse.arrayBuffer()
          const filename = `products/${params.id}/ml-${picture.id}.jpg`

          // Upload no Vercel Blob
          const blob = await put(filename, imageBuffer, {
            access: "public",
            contentType: "image/jpeg"
          })

          // Salvar no banco
          const image = await prisma.productImage.create({
            data: {
              productId: params.id,
              url: blob.url,
              mlUrl: imageUrl,
              order: index
            }
          })

          return image
        } catch (error) {
          console.error(`Erro ao importar imagem ${picture.id}:`, error)
          return null
        }
      })
    )

    const successfulImports = importedImages.filter((img) => img !== null)

    return NextResponse.json({
      imported: successfulImports.length,
      total: mlProduct.pictures.length,
      images: successfulImports
    })
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error)
    console.error("Error importing ML images:", error)
    return NextResponse.json(
      { error: "Erro ao importar imagens do ML" },
      { status: 500 }
    )
  }
}
