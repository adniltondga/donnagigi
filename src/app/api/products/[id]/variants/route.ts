import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import {
  getProductStockSummary,
} from "@/lib/variants"

/**
 * GET /api/products/[id]/variants
 * Buscar todas as variações de um produto
 * 
 * Query params:
 * - cor: string (filtro)
 * - modelo: string (filtro)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id
    const searchParams = request.nextUrl.searchParams

    // Verificar se produto existe
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      )
    }

    // Buscar variações com aplicar filtros
    let variants = await prisma.productVariant.findMany({
      where: { productId, active: true },
      include: {
        model: true,
        color: true,
        attributes: {
          include: {
            attributeValue: {
              include: { attribute: true },
            },
          },
        },
      },
    })

    // Aplicar filtros se fornecidos
    if (searchParams.size > 0) {
      const filters: Record<string, string> = {}
      searchParams.forEach((value, key) => {
        filters[key] = value
      })
      variants = variants.filter((variant) => {
        const variantAttrs = variant.attributes.reduce(
          (acc, va) => {
            acc[va.attributeValue.attribute.name] = va.attributeValue.value
            return acc
          },
          {} as Record<string, string>
        )
        return Object.entries(filters).every(
          ([key, value]) => variantAttrs[key] === value
        )
      })
    }

    // Formatar resposta
    const formattedVariants = variants.map((variant) => ({
      id: variant.id,
      cod: variant.cod,
      salePrice: variant.salePrice,
      purchaseCost: variant.purchaseCost,
      boxCost: variant.boxCost,
      stock: variant.stock,
      calculatedMargin: variant.calculatedMargin,
      image: variant.image || product.baseImage,
      attributes: variant.attributes.reduce(
        (acc, va) => {
          acc[va.attributeValue.attribute.name] = va.attributeValue.value
          return acc
        },
        {} as Record<string, string>
      ),
      mlListed: variant.mlListed,
      mlListingId: variant.mlListingId,
    }))

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        image: product.baseImage,
      },
      variants: formattedVariants,
      total: formattedVariants.length,
      stockSummary: await getProductStockSummary(productId),
    })
  } catch (error) {
    console.error("Erro ao buscar variações:", error)
    return NextResponse.json(
      { error: "Erro ao buscar variações" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products/[id]/variants
 * Criar nova variação
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id
    const body = await request.json()

    const {
      cod,
      modelId,
      colorId,
      salePrice,
      purchaseCost,
      boxCost,
      stock,
      image,
    } = body

    // Validar dados obrigatórios
    if (!cod || !salePrice) {
      return NextResponse.json(
        { error: "COD e salePrice são obrigatórios" },
        { status: 400 }
      )
    }

    // Criar variação
    const variant = await prisma.productVariant.create({
      data: {
        productId,
        cod,
        modelId: modelId || null,
        colorId: colorId || null,
        salePrice: parseFloat(salePrice),
        purchaseCost: purchaseCost ? parseFloat(purchaseCost) : null,
        boxCost: boxCost ? parseFloat(boxCost) : null,
        stock: stock ? parseInt(stock) : 0,
        image: image || null,
        active: true,
      },
      include: {
        model: true,
        color: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Variação criada com sucesso",
      data: variant,
    })
  } catch (error) {
    console.error("Erro ao criar variação:", error)
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Erro ao criar variação" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/products/[id]/variants/[variantId]
 * Atualizar variação (estoque, preço, etc)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  try {
    const { id: productId, variantId } = params
    const body = await request.json()

    // Verificar se variante pertence ao produto
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    })

    if (!variant || variant.productId !== productId) {
      return NextResponse.json(
        { error: "Variação não encontrada" },
        { status: 404 }
      )
    }

    // Atualizar dados
    const updatedVariant = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(body.stock !== undefined && { stock: body.stock }),
        ...(body.salePrice && { salePrice: body.salePrice }),
        ...(body.purchaseCost && { purchaseCost: body.purchaseCost }),
        ...(body.boxCost && { boxCost: body.boxCost }),
        ...(body.image && { image: body.image }),
        ...(body.mlListed !== undefined && { mlListed: body.mlListed }),
        ...(body.mlListingId && { mlListingId: body.mlListingId }),
      },
    })

    return NextResponse.json({
      message: "Variação atualizada com sucesso",
      variant: updatedVariant,
    })
  } catch (error) {
    console.error("Erro ao atualizar variação:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar variação" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/products/[id]/variants/[variantId]
 * Desativar variação (soft delete)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  try {
    const { id: productId, variantId } = params

    // Verificar se variante pertence ao produto
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    })

    if (!variant || variant.productId !== productId) {
      return NextResponse.json(
        { error: "Variação não encontrada" },
        { status: 404 }
      )
    }

    // Desativar (not hard delete to preserve data)
    await prisma.productVariant.update({
      where: { id: variantId },
      data: { active: false },
    })

    return NextResponse.json({
      message: "Variação desativada com sucesso",
    })
  } catch (error) {
    console.error("Erro ao desativar variação:", error)
    return NextResponse.json(
      { error: "Erro ao desativar variação" },
      { status: 500 }
    )
  }
}
