import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET - Listar todas as cores
export async function GET(_req: NextRequest) {
  try {
    const colors = await prisma.deviceColor.findMany({
      orderBy: [{ active: 'desc' }, { order: 'asc' }, { name: 'asc' }],
      include: {
        modelColors: {
          include: {
            model: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: colors })
  } catch (error) {
    console.error('GET /api/device-colors:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar cores' },
      { status: 500 }
    )
  }
}

// POST - Criar nova cor
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, hexColor, order = 0 } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Nome da cor é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se cor já existe
    const existingColor = await prisma.deviceColor.findUnique({
      where: { name },
    })

    if (existingColor) {
      return NextResponse.json(
        { success: false, error: 'Cor com este nome já existe' },
        { status: 400 }
      )
    }

    const color = await prisma.deviceColor.create({
      data: {
        name,
        hexColor: hexColor || '#000000',
        order: parseInt(order) || 0,
        active: true,
      },
    })

    return NextResponse.json({ success: true, data: color }, { status: 201 })
  } catch (error) {
    console.error('POST /api/device-colors:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar cor' },
      { status: 500 }
    )
  }
}
