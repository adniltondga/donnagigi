import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { calculateMargin } from '@/lib/calculations'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count(),
    ])

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('GET /api/products:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar produtos' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validar campos obrigatórios
    const requiredFields = [
      'name',
      'purchaseCost',
      'boxCost',
      'mlTariff',
      'deliveryTariff',
      'salePrice',
      'stock',
    ]

    for (const field of requiredFields) {
      if (!(field in body)) {
        return NextResponse.json(
          { success: false, error: `Campo obrigatório faltando: ${field}` },
          { status: 400 }
        )
      }
    }

    // Calcular margem
    const calculatedMargin = calculateMargin({
      purchaseCost: body.purchaseCost,
      boxCost: body.boxCost,
      mlTariff: body.mlTariff,
      deliveryTariff: body.deliveryTariff,
      salePrice: body.salePrice,
    })

    const product = await prisma.product.create({
      data: {
        name: body.name,
        baseModel: body.baseModel || null,
        colorVariant: body.colorVariant || null,
        supplier: body.supplier || null,
        purchaseCost: parseFloat(body.purchaseCost),
        boxCost: parseFloat(body.boxCost),
        mlTariff: parseFloat(body.mlTariff),
        deliveryTariff: parseFloat(body.deliveryTariff),
        salePrice: parseFloat(body.salePrice),
        calculatedMargin,
        stock: parseInt(body.stock),
        minStock: body.minStock ? parseInt(body.minStock) : 5,
        description: body.description || null,
        image: body.image || 'https://via.placeholder.com/300x300?text=Produto',
        category: body.category || 'Outros',
      },
    })

    return NextResponse.json(
      { success: true, data: product },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/products:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar produto' },
      { status: 500 }
    )
  }
}
