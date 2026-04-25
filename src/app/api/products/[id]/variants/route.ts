import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { AuthError, authErrorResponse, requireRole } from "@/lib/auth"

/**
 * GET /api/products/[id]/variants
 * Buscar todas as variações de um produto
 * 
 * Query params:
 * - cor: string (filtro)
 * - modelo: string (filtro)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id

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

    // Buscar variações
    const variants = await prisma.productVariant.findMany({
      where: { productId, active: true },
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
    })

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
      },
      variants: variants,
      total: variants.length,
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
    await requireRole(['OWNER', 'ADMIN'])
    const productId = params.id
    const body = await request.json()

    const {
      cod,
      title,
      salePrice,
      stock,
    } = body

    // Validar dados obrigatórios
    if (!cod || cod.trim() === '') {
      return NextResponse.json(
        { error: "COD é obrigatório" },
        { status: 400 }
      )
    }

    const salePriceNum = parseFloat(salePrice)
    if (isNaN(salePriceNum) || salePriceNum <= 0) {
      return NextResponse.json(
        { error: "salePrice é obrigatório e deve ser maior que 0" },
        { status: 400 }
      )
    }

    // Pega tenantId do produto pai (também valida existência)
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { tenantId: true },
    })
    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
    }

    // Criar variação
    const variant = await prisma.productVariant.create({
      data: {
        productId,
        tenantId: product.tenantId,
        cod,
        title: title || null,
        salePrice: parseFloat(salePrice),
        stock: stock ? parseInt(stock) : 0,
        active: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Variação criada com sucesso",
      data: variant,
    })
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error)
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
    await requireRole(['OWNER', 'ADMIN'])
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
    if (error instanceof AuthError) return authErrorResponse(error)
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
    await requireRole(['OWNER', 'ADMIN'])
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
    if (error instanceof AuthError) return authErrorResponse(error)
    console.error("Erro ao desativar variação:", error)
    return NextResponse.json(
      { error: "Erro ao desativar variação" },
      { status: 500 }
    )
  }
}
