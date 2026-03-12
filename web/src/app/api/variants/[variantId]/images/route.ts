import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import prisma from '@/lib/prisma'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_IMAGES_PER_VARIANT = 5
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// GET - Listar imagens da variação
export async function GET(
  _req: NextRequest,
  { params }: { params: { variantId: string } }
) {
  try {
    const { variantId } = params

    // Validar que a variação existe
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    })

    if (!variant) {
      return NextResponse.json(
        { success: false, error: 'Variação não encontrada' },
        { status: 404 }
      )
    }

    // Buscar imagens ordenadas
    const images = await prisma.variantImage.findMany({
      where: { variantId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        url: true,
        order: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: images,
    })
  } catch (error) {
    console.error('GET /api/variants/[variantId]/images:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar imagens' },
      { status: 500 }
    )
  }
}

// POST - Upload de imagens
export async function POST(
  req: NextRequest,
  { params }: { params: { variantId: string } }
) {
  try {
    const { variantId } = params
    const formData = await req.formData()

    // Validar que a variação existe
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    })

    if (!variant) {
      return NextResponse.json(
        { success: false, error: 'Variação não encontrada' },
        { status: 404 }
      )
    }

    // Contar imagens existentes
    const existingCount = await prisma.variantImage.count({
      where: { variantId },
    })

    // Obter arquivos do formData
    const files: File[] = []
    formData.forEach((value) => {
      if (value instanceof File) {
        files.push(value)
      }
    })

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhum arquivo enviado' },
        { status: 400 }
      )
    }

    // Validar quantidade total de imagens
    if (existingCount + files.length > MAX_IMAGES_PER_VARIANT) {
      return NextResponse.json(
        {
          success: false,
          error: `Máximo de ${MAX_IMAGES_PER_VARIANT} imagens permitido. Já existem ${existingCount} imagens.`,
        },
        { status: 400 }
      )
    }

    const uploadedImages: any[] = []

    // Processar cada arquivo
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validar tipo MIME
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            success: false,
            error: `Arquivo ${file.name}: tipo não permitido. Use JPG, PNG ou WebP`,
          },
          { status: 400 }
        )
      }

      // Validar tamanho
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error: `Arquivo ${file.name}: excede 5MB`,
          },
          { status: 400 }
        )
      }

      try {
        // Upload para Vercel Blob
        const timestamp = Date.now()
        const blob = await put(
          `products/${variant.productId}/variants/${variantId}/${timestamp}-${i}-${file.name}`,
          file,
          { access: 'public' }
        )

        // Calcular ordem (próxima imagem)
        const order = existingCount + i + 1

        // Salvar no banco de dados
        const image = await prisma.variantImage.create({
          data: {
            variantId,
            productId: variant.productId,
            url: blob.url,
            order,
          },
          select: {
            id: true,
            url: true,
            order: true,
            createdAt: true,
          },
        })

        uploadedImages.push(image)
      } catch (error) {
        console.error(`Erro ao fazer upload do arquivo ${file.name}:`, error)
        return NextResponse.json(
          {
            success: false,
            error: `Erro ao fazer upload do arquivo ${file.name}`,
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: uploadedImages,
      message: `${uploadedImages.length} imagem(ns) enviada(s) com sucesso`,
    })
  } catch (error) {
    console.error('POST /api/variants/[variantId]/images:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao fazer upload de imagens' },
      { status: 500 }
    )
  }
}

// DELETE - Remover imagem
export async function DELETE(
  req: NextRequest,
  { params }: { params: { variantId: string } }
) {
  try {
    const { variantId } = params
    const { searchParams } = new URL(req.url)
    const imageId = searchParams.get('imageId')

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: 'imageId é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar imagem
    const image = await prisma.variantImage.findUnique({
      where: { id: imageId },
    })

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Imagem não encontrada' },
        { status: 404 }
      )
    }

    // Validar que a imagem pertence à variação
    if (image.variantId !== variantId) {
      return NextResponse.json(
        { success: false, error: 'Imagem não pertence a esta variação' },
        { status: 403 }
      )
    }

    try {
      // Deletar do Vercel Blob
      await del(image.url)
    } catch (error) {
      console.error('Erro ao deletar imagem do Vercel Blob:', error)
      // Continuar mesmo se falhar ao deletar do blob
    }

    // Deletar do banco de dados
    await prisma.variantImage.delete({
      where: { id: imageId },
    })

    // Reordenar imagens restantes
    const remainingImages = await prisma.variantImage.findMany({
      where: { variantId },
      orderBy: { order: 'asc' },
    })

    for (let i = 0; i < remainingImages.length; i++) {
      await prisma.variantImage.update({
        where: { id: remainingImages[i].id },
        data: { order: i + 1 },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Imagem deletada com sucesso',
    })
  } catch (error) {
    console.error('DELETE /api/variants/[variantId]/images:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar imagem' },
      { status: 500 }
    )
  }
}
