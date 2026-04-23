import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { del } from "@vercel/blob"
import { AuthError, authErrorResponse, requireRole } from "@/lib/auth"

const prisma = new PrismaClient()

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { variantId: string; imageId: string } }
) {
  try {
    await requireRole(['OWNER', 'ADMIN'])
    // Buscar imagem
    const image = await prisma.variantImage.findUnique({
      where: { id: params.imageId }
    })

    if (!image) {
      return NextResponse.json(
        { error: "Imagem não encontrada" },
        { status: 404 }
      )
    }

    // Validar que a imagem pertence à variação
    if (image.variantId !== params.variantId) {
      return NextResponse.json(
        { error: "Imagem não pertence a esta variação" },
        { status: 403 }
      )
    }

    // Deletar do Vercel Blob
    try {
      await del(image.url)
    } catch (blobError) {
      console.error("Error deleting from Blob:", blobError)
      // Continua mesmo se falhar no Blob (pode ter sido deletado manualmente)
    }

    // Deletar do banco
    await prisma.variantImage.delete({
      where: { id: params.imageId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error)
    console.error("Error deleting variant image:", error)
    return NextResponse.json(
      { error: "Erro ao deletar imagem" },
      { status: 500 }
    )
  }
}
