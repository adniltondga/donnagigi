import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AuthError, authErrorResponse, requireRole } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        variants: {
          where: { active: true },
          select: {
            id: true,
            cod: true,
            title: true,
            salePrice: true,
            stock: true,
            mlListingId: true,
            active: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('GET /api/products/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar produto' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['OWNER', 'ADMIN'])
    const body = await req.json()

    // Verificar se produto existe
    const existingProduct = await prisma.product.findUnique({
      where: { id: params.id },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      )
    }

    // Campos de variação foram movidos para ProductVariant
    // Retornar aviso se usuário tentar atualizar esses campos específicos de variação
    const variantSpecificFields = [
      'stock',
      'cod',
    ]

    const attemptedVariationUpdate = variantSpecificFields.some((field) =>
      body.hasOwnProperty(field)
    )

    if (attemptedVariationUpdate) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Campos de estoque e COD devem ser atualizados via PUT /api/products/[id]/variants/[variantId]',
        },
        { status: 400 }
      )
    }

    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.mlListingId !== undefined && { mlListingId: body.mlListingId || null }),
        ...(body.baseSalePrice !== undefined && { baseSalePrice: body.baseSalePrice ? parseFloat(body.baseSalePrice) : null }),
        ...(body.minStock !== undefined && { minStock: body.minStock ? parseInt(body.minStock) : 0 }),
        ...(body.productCost !== undefined && { productCost: body.productCost ? parseFloat(body.productCost) : null }),
      },
      include: {
        variants: {
          where: { active: true },
          select: {
            id: true,
            cod: true,
            title: true,
            salePrice: true,
            stock: true,
            mlListingId: true,
            active: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updatedProduct })
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error)
    console.error('PUT /api/products/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar produto' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['OWNER', 'ADMIN'])
    const product = await prisma.product.findUnique({
      where: { id: params.id },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      )
    }

    await prisma.product.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Produto deletado com sucesso',
    })
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error)
    console.error('DELETE /api/products/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar produto' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['OWNER', 'ADMIN'])
    const body = await req.json()

    // Verificar se produto existe
    const existingProduct = await prisma.product.findUnique({
      where: { id: params.id },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      )
    }

    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(body.active !== undefined && { active: body.active }),
      },
      include: {
        variants: {
          where: { active: true },
          select: {
            id: true,
            cod: true,
            title: true,
            salePrice: true,
            stock: true,
            mlListingId: true,
            active: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `Produto ${updatedProduct.active ? 'ativado' : 'desativado'} com sucesso`,
      data: updatedProduct,
    })
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error)
    console.error('PATCH /api/products/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar status do produto' },
      { status: 500 }
    )
  }
}
