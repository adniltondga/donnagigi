import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const category = await prisma.category.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Categoria não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error('GET /api/categories/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar categoria' },
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

    const category = await prisma.category.findUnique({
      where: { id: params.id },
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Categoria não encontrada' },
        { status: 404 }
      )
    }

    // Se mudou de nome, verificar duplicata
    if (body.name && body.name.trim() !== category.name) {
      const existing = await prisma.category.findUnique({
        where: { name: body.name.trim() },
      })

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Uma categoria com este nome já existe' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.category.update({
      where: { id: params.id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.order !== undefined && { order: body.order }),
        ...(body.active !== undefined && { active: body.active }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('PUT /api/categories/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar categoria' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const category = await prisma.category.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Categoria não encontrada' },
        { status: 404 }
      )
    }

    if (category._count.products > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Não é possível deletar. Esta categoria tem ${category._count.products} produto(s) associado(s)`,
        },
        { status: 400 }
      )
    }

    await prisma.category.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Categoria deletada com sucesso',
    })
  } catch (error) {
    console.error('DELETE /api/categories/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar categoria' },
      { status: 500 }
    )
  }
}
