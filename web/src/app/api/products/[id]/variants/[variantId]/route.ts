import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface Params {
  params: Promise<{ id: string; variantId: string }>
}

/**
 * GET /api/products/[id]/variants/[variantId]
 * Buscar uma variação específica
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id: productId, variantId } = await params

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
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
    })

    if (!variant || variant.productId !== productId) {
      return NextResponse.json(
        { success: false, error: 'Variação não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: variant })
  } catch (error) {
    console.error('GET /api/products/[id]/variants/[variantId]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar variação' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/products/[id]/variants/[variantId]
 * Atualizar variação (estoque, preço, etc)
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: productId, variantId } = await params
    const body = await request.json()

    // Verificar se variante pertence ao produto
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    })

    if (!variant || variant.productId !== productId) {
      return NextResponse.json(
        { success: false, error: 'Variação não encontrada' },
        { status: 404 }
      )
    }

    // Atualizar dados
    const updatedVariant = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(body.stock !== undefined && { stock: body.stock }),
        ...(body.salePrice !== undefined && { salePrice: body.salePrice ? parseFloat(body.salePrice) : body.salePrice }),
        ...(body.purchaseCost !== undefined && { purchaseCost: body.purchaseCost }),
        ...(body.boxCost !== undefined && { boxCost: body.boxCost }),
        ...(body.mlTariff !== undefined && { mlTariff: body.mlTariff }),
        ...(body.deliveryTariff !== undefined && { deliveryTariff: body.deliveryTariff }),
        ...(body.shoppeeTariff !== undefined && { shoppeeTariff: body.shoppeeTariff }),
        ...(body.shopeeDeliveryTariff !== undefined && { shopeeDeliveryTariff: body.shopeeDeliveryTariff }),
      },
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
    })

    return NextResponse.json({ success: true, data: updatedVariant })
  } catch (error) {
    console.error('PATCH /api/products/[id]/variants/[variantId]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar variação' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/products/[id]/variants/[variantId]
 * Deletar uma variação
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id: productId, variantId } = await params

    // Verificar se variante pertence ao produto
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    })

    if (!variant || variant.productId !== productId) {
      return NextResponse.json(
        { success: false, error: 'Variação não encontrada' },
        { status: 404 }
      )
    }

    // Deletar a variante
    await prisma.productVariant.delete({
      where: { id: variantId },
    })

    return NextResponse.json({
      success: true,
      message: 'Variação deletada com sucesso',
    })
  } catch (error) {
    console.error('DELETE /api/products/[id]/variants/[variantId]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar variação' },
      { status: 500 }
    )
  }
}
