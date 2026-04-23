import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getTenantIdOrDefault } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit
    const search = searchParams.get('search')

    const tenantId = await getTenantIdOrDefault()
    const whereClause: any = { tenantId }
    if (search) {
      whereClause.OR = [
        { mlListingId: search },
        { name: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          mlListingId: true,
          baseSalePrice: true,
          minStock: true,
          active: true,
          productCost: true,
          createdAt: true,
          updatedAt: true,
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
              images: {
                select: {
                  id: true,
                  url: true,
                  order: true,
                },
                orderBy: { order: 'asc' as const },
              }
            }
          }
        }
      }),
      prisma.product.count({ where: whereClause }),
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
    const requiredFields = ['name']
    for (const field of requiredFields) {
      if (!(field in body)) {
        return NextResponse.json(
          { success: false, error: `Campo obrigatório faltando: ${field}` },
          { status: 400 }
        )
      }
    }

    // Validar variações
    if (!body.variants || !Array.isArray(body.variants) || body.variants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pelo menos 1 variação é obrigatória' },
        { status: 400 }
      )
    }

    // Validar cada variação
    for (let i = 0; i < body.variants.length; i++) {
      const variant = body.variants[i]
      
      if (!variant.cod || variant.cod.trim() === '') {
        return NextResponse.json(
          { success: false, error: `Variação ${i + 1}: COD é obrigatório` },
          { status: 400 }
        )
      }
      
      const salePrice = parseFloat(variant.salePrice)
      if (isNaN(salePrice) || salePrice <= 0) {
        return NextResponse.json(
          { success: false, error: `Variação ${i + 1}: salePrice é obrigatório e deve ser maior que 0` },
          { status: 400 }
        )
      }
    }

    // 1. Criar Produto
    const tenantId = await getTenantIdOrDefault()
    const product = await prisma.product.create({
      data: {
        name: body.name,
        description: body.description || null,
        mlListingId: body.mlListingId || null,
        baseSalePrice: body.baseSalePrice ? parseFloat(body.baseSalePrice) : null,
        minStock: body.minStock ? parseInt(body.minStock) : 5,
        tenantId,
      },
    })

    // 2. Criar Variações
    const createdVariants = []
    for (const variantData of body.variants) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          cod: variantData.cod,
          title: variantData.title || null,
          salePrice: parseFloat(variantData.salePrice),
          stock: variantData.stock ? parseInt(variantData.stock) : 0,
          mlListingId: variantData.mlListingId || null,
          active: true,
        },
      })

      createdVariants.push(variant)
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          product,
          variants: createdVariants,
          variantsCount: createdVariants.length,
        },
      },
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
