import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET - Listar todos os modelos
export async function GET(_req: NextRequest) {
  try {
    const models = await prisma.deviceModel.findMany({
      orderBy: [{ active: 'desc' }, { order: 'asc' }, { name: 'asc' }],
      include: {
        modelColors: {
          include: {
            color: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: models })
  } catch (error) {
    console.error('GET /api/device-models:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar modelos' },
      { status: 500 }
    )
  }
}

// POST - Criar novo modelo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description = '', color = '#000000', order = 0, colorIds = [] } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Nome do modelo é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se modelo já existe
    const existingModel = await prisma.deviceModel.findUnique({
      where: { name },
    })

    if (existingModel) {
      return NextResponse.json(
        { success: false, error: 'Modelo com este nome já existe' },
        { status: 400 }
      )
    }

    const model = await prisma.deviceModel.create({
      data: {
        name,
        description,
        color,
        order: parseInt(order) || 0,
        active: true,
        // Associar cores se fornecidas
        ...(colorIds.length > 0 && {
          modelColors: {
            create: colorIds.map((colorId: string) => ({
              colorId,
            })),
          },
        }),
      },
      include: {
        modelColors: {
          include: {
            color: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: model }, { status: 201 })
  } catch (error) {
    console.error('POST /api/device-models:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar modelo' },
      { status: 500 }
    )
  }
}
