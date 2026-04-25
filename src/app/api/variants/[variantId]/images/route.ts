import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { put } from "@vercel/blob"
import { AuthError, authErrorResponse, requireRole } from "@/lib/auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: { variantId: string } }
) {
  try {
    const images = await prisma.variantImage.findMany({
      where: { variantId: params.variantId },
      orderBy: { order: "asc" }
    })

    return NextResponse.json(images)
  } catch (error) {
    console.error("Error fetching variant images:", error)
    return NextResponse.json(
      { error: "Erro ao buscar imagens da variação" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { variantId: string } }
) {
  try {
    await requireRole(['OWNER', 'ADMIN'])
    // Validar que a variação existe
    const variant = await prisma.productVariant.findUnique({
      where: { id: params.variantId }
    })

    if (!variant) {
      return NextResponse.json(
        { error: "Variação não encontrada" },
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
    const filename = `variants/${params.variantId}/${Date.now()}-${file.name}`

    const blob = await put(filename, buffer, {
      access: "public",
      contentType: file.type
    })

    // Contar imagens existentes para definir order
    const imageCount = await prisma.variantImage.count({
      where: { variantId: params.variantId }
    })

    // Salvar no banco
    const image = await prisma.variantImage.create({
      data: {
        variantId: params.variantId,
        url: blob.url,
        order: imageCount
      }
    })

    return NextResponse.json(image, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error)
    console.error("Error uploading variant image:", error)
    return NextResponse.json(
      { error: "Erro ao fazer upload da imagem" },
      { status: 500 }
    )
  }
}
