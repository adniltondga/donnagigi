import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { calculateMargin } from '@/lib/calculations'

export async function GET(
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

    // Calcular margem se preços mudaram
    let calculatedMargin = existingProduct.calculatedMargin

    if (
      body.purchaseCost ||
      body.boxCost ||
      body.mlTariff ||
      body.deliveryTariff ||
      body.salePrice
    ) {
      calculatedMargin = calculateMargin({
        purchaseCost: body.purchaseCost || existingProduct.purchaseCost,
        boxCost: body.boxCost || existingProduct.boxCost,
        mlTariff: body.mlTariff || existingProduct.mlTariff,
        deliveryTariff: body.deliveryTariff || existingProduct.deliveryTariff,
        salePrice: body.salePrice || existingProduct.salePrice,
      })
    }

    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.baseModel !== undefined && { baseModel: body.baseModel }),
        ...(body.colorVariant !== undefined && { colorVariant: body.colorVariant }),
        ...(body.supplier !== undefined && { supplier: body.supplier }),
        ...(body.purchaseCost !== undefined && {
          purchaseCost: parseFloat(body.purchaseCost),
        }),
        ...(body.boxCost !== undefined && { boxCost: parseFloat(body.boxCost) }),
        ...(body.mlTariff !== undefined && {
          mlTariff: parseFloat(body.mlTariff),
        }),
        ...(body.deliveryTariff !== undefined && {
          deliveryTariff: parseFloat(body.deliveryTariff),
        }),
        ...(body.salePrice !== undefined && {
          salePrice: parseFloat(body.salePrice),
        }),
        ...(calculatedMargin && { calculatedMargin }),
        ...(body.stock !== undefined && { stock: parseInt(body.stock) }),
        ...(body.minStock !== undefined && { minStock: parseInt(body.minStock) }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.image !== undefined && { image: body.image }),
        ...(body.category !== undefined && { category: body.category }),
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
