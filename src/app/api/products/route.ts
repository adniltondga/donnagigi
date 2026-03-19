import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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
        select: {
          id: true,
          name: true,
          description: true,
          categoryId: true,
          supplier: true,
          mlListingId: true,
          shopeeListingId: true,
          baseSalePrice: true,
          basePurchaseCost: true,
          baseBoxCost: true,
          baseMLTariff: true,
          baseDeliveryTariff: true,
          baseShoppeeTariff: true,
          baseShopeeDeliveryTariff: true,
          baseMLPrice: true,
          shopeePrice: true,
          minStock: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          category: true,
          variants: {
            where: { active: true },
            select: {
              id: true,
              productId: true,
              modelId: true,
              model: true,
              colorId: true,
              color: true,
              cod: true,
              image: true,
              purchaseCost: true,
              boxCost: true,
              mlTariff: true,
              deliveryTariff: true,
              shoppeeTariff: true,
              shopeeDeliveryTariff: true,
              salePrice: true,
              calculatedMargin: true,
              stock: true,
              mlListed: true,
              mlListingId: true,
              mlListingUrl: true,
              shopeeListed: true,
              shopeeListingId: true,
              shopeeListingUrl: true,
              active: true,
              createdAt: true,
              updatedAt: true,
              attributes: {
                include: { attributeValue: true }
              }
            }
          }
        }
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
    const requiredFields = ['name', 'description']
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
    const product = await prisma.product.create({
      data: {
        name: body.name,
        description: body.description,
        categoryId: body.categoryId || null,
        supplier: body.supplier || null,
        mlListingId: body.mlListingId || null,
        shopeeListingId: body.shopeeListingId || null,
        baseSalePrice: body.baseSalePrice ? parseFloat(body.baseSalePrice) : null,
        basePurchaseCost: body.basePurchaseCost ? parseFloat(body.basePurchaseCost) : 0,
        baseBoxCost: body.baseBoxCost ? parseFloat(body.baseBoxCost) : 0,
        baseMLTariff: body.baseMLTariff ? parseFloat(body.baseMLTariff) : 0,
        baseDeliveryTariff: body.baseDeliveryTariff ? parseFloat(body.baseDeliveryTariff) : 0,
        baseMLPrice: body.baseMLPrice ? parseFloat(body.baseMLPrice) : null,
        shopeePrice: body.shopeePrice ? parseFloat(body.shopeePrice) : null,
        baseShoppeeTariff: body.baseShoppeeTariff ? parseFloat(body.baseShoppeeTariff) : 0,
        baseShopeeDeliveryTariff: body.baseShopeeDeliveryTariff ? parseFloat(body.baseShopeeDeliveryTariff) : 0,
        minStock: body.minStock ? parseInt(body.minStock) : 5,
      },
    })

    // 2. Criar Atributos (se fornecidos)
    const attributeMap: Record<string, string> = {} // name -> id
    
    if (body.attributes && Array.isArray(body.attributes)) {
      for (const attr of body.attributes) {
        if (!attr.name || !attr.values) continue

        const productAttr = await prisma.productAttribute.create({
          data: {
            productId: product.id,
            name: attr.name,
            type: attr.type || 'text',
          },
        })
        attributeMap[attr.name] = productAttr.id

        // Criar valores do atributo
        for (const value of attr.values) {
          await prisma.productAttributeValue.create({
            data: {
              attributeId: productAttr.id,
              value,
            },
          })
        }
      }
    }

    // 3. Criar Variações
    const createdVariants = []
    for (const variantData of body.variants) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          cod: variantData.cod,
          image: variantData.image || null,
          purchaseCost: variantData.purchaseCost ? parseFloat(variantData.purchaseCost) : null,
          boxCost: variantData.boxCost ? parseFloat(variantData.boxCost) : null,
          mlTariff: variantData.mlTariff ? parseFloat(variantData.mlTariff) : 0,
          deliveryTariff: variantData.deliveryTariff ? parseFloat(variantData.deliveryTariff) : 0,
          salePrice: parseFloat(variantData.salePrice),
          stock: variantData.stock ? parseInt(variantData.stock) : 0,
          active: true,
        },
      })

      // Associar atributos à variante (se fornecidos)
      if (variantData.attributes && typeof variantData.attributes === 'object') {
        for (const [attrName, attrValue] of Object.entries(variantData.attributes)) {
          const attrId = attributeMap[attrName]
          if (!attrId) continue

          // Encontrar o valor do atributo
          const attrVal = await prisma.productAttributeValue.findFirst({
            where: {
              attributeId: attrId,
              value: String(attrValue),
            },
          })

          if (attrVal) {
            await prisma.variantAttributeValue.create({
              data: {
                variantId: variant.id,
                attributeValueId: attrVal.id,
              },
            })
          }
        }
      }

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
