import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      data: categories,
    })
  } catch (error) {
    console.error('GET /api/categories:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar categorias' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Nome da categoria é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar duplicata
    const existing = await prisma.category.findUnique({
      where: { name: body.name.trim() },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Esta categoria já existe' },
        { status: 400 }
      )
    }

    const category = await prisma.category.create({
      data: {
        name: body.name.trim(),
        order: body.order || 0,
      },
    })

    return NextResponse.json({
      success: true,
      data: category,
    })
  } catch (error) {
    console.error('POST /api/categories:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar categoria' },
      { status: 500 }
    )
  }
}
