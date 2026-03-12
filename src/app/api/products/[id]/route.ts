import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        variants: {
          where: { active: true },
          include: {
            model: true,
            color: true,
            attributes: {
              include: {
                attributeValue: {
                  include: {
                    attribute: true,
                  },
                },
              },
            },
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
        ...(body.categoryId !== undefined && { categoryId: body.categoryId || null }),
        ...(body.supplier !== undefined && { supplier: body.supplier }),
        ...(body.mlListingId !== undefined && { mlListingId: body.mlListingId || null }),
        ...(body.shopeeListingId !== undefined && { shopeeListingId: body.shopeeListingId || null }),
        ...(body.baseSalePrice !== undefined && { baseSalePrice: body.baseSalePrice ? parseFloat(body.baseSalePrice) : null }),
        ...(body.basePurchaseCost !== undefined && { basePurchaseCost: body.basePurchaseCost ? parseFloat(body.basePurchaseCost) : 0 }),
        ...(body.baseBoxCost !== undefined && { baseBoxCost: body.baseBoxCost ? parseFloat(body.baseBoxCost) : 0 }),
        ...(body.baseMLTariff !== undefined && { baseMLTariff: body.baseMLTariff ? parseFloat(body.baseMLTariff) : 0 }),
        ...(body.baseDeliveryTariff !== undefined && { baseDeliveryTariff: body.baseDeliveryTariff ? parseFloat(body.baseDeliveryTariff) : 0 }),
        ...(body.baseMLPrice !== undefined && { baseMLPrice: body.baseMLPrice ? parseFloat(body.baseMLPrice) : null }),
        ...(body.shopeePrice !== undefined && { shopeePrice: body.shopeePrice ? parseFloat(body.shopeePrice) : null }),
      },
      include: {
        category: true,
        variants: {
          where: { active: true },
          include: {
            attributes: {
              include: {
                attributeValue: {
                  include: {
                    attribute: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updatedProduct })
  } catch (error) {
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
    console.error('DELETE /api/products/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar produto' },
      { status: 500 }
    )
  }
}
