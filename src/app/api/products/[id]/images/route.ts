import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { put } from "@vercel/blob"
import { AuthError, authErrorResponse, requireRole } from "@/lib/auth"

const prisma = new PrismaClient()

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const images = await prisma.productImage.findMany({
      where: { productId: params.id },
      orderBy: { order: "asc" }
    })

    return NextResponse.json(images)
  } catch (error) {
    console.error("Error fetching images:", error)
    return NextResponse.json(
      { error: "Erro ao buscar imagens" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['OWNER', 'ADMIN'])
    // Validar que o produto existe
    const product = await prisma.product.findUnique({
      where: { id: params.id }
    })

    if (!product) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      )
    }

    // Parse multipart form-data
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não enviado" },
        { status: 400 }
      )
    }

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Arquivo deve ser uma imagem" },
        { status: 400 }
      )
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Imagem não pode ser maior que 5MB" },
        { status: 400 }
      )
    }

    // Upload no Vercel Blob
    const buffer = await file.arrayBuffer()
    const filename = `products/${params.id}/${Date.now()}-${file.name}`

    const blob = await put(filename, buffer, {
      access: "public",
      contentType: file.type
    })

    // Contar imagens existentes para definir order
    const imageCount = await prisma.productImage.count({
      where: { productId: params.id }
    })

    // Salvar no banco
    const image = await prisma.productImage.create({
      data: {
        productId: params.id,
        url: blob.url,
        order: imageCount
      }
    })

    return NextResponse.json(image, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error)
    console.error("Error uploading image:", error)
    return NextResponse.json(
      { error: "Erro ao fazer upload da imagem" },
      { status: 500 }
    )
  }
}
