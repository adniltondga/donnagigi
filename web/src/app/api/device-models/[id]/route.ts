import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET - Detalhes de um modelo
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const model = await prisma.deviceModel.findUnique({
      where: { id: params.id },
      include: {
        modelColors: {
          include: {
            color: true,
          },
        },
      },
    })

    if (!model) {
      return NextResponse.json(
        { success: false, error: 'Modelo não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: model })
  } catch (error) {
    console.error('GET /api/device-models/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar modelo' },
      { status: 500 }
    )
  }
}

// PUT - Editar modelo
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { name, description, color, active, order, colorIds } = body

    // Verificar se modelo existe
    const existingModel = await prisma.deviceModel.findUnique({
      where: { id: params.id },
    })

    if (!existingModel) {
      return NextResponse.json(
        { success: false, error: 'Modelo não encontrado' },
        { status: 404 }
      )
    }

    // Se mudar nome, verificar duplicata
    if (name && name !== existingModel.name) {
      const duplicate = await prisma.deviceModel.findUnique({
        where: { name },
      })
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'Modelo com este nome já existe' },
          { status: 400 }
        )
      }
    }

    // Se colorIds foi fornecido, atualizar associações
    if (colorIds && Array.isArray(colorIds)) {
      // Remover todas as associações antigas
      await prisma.deviceModelColor.deleteMany({
        where: { modelId: params.id },
      })

      // Criar novas associações
      if (colorIds.length > 0) {
        await prisma.deviceModelColor.createMany({
          data: colorIds.map((colorId: string) => ({
            modelId: params.id,
            colorId,
          })),
        })
      }
    }

    const updatedModel = await prisma.deviceModel.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(color && { color }),
        ...(active !== undefined && { active }),
        ...(order !== undefined && { order: parseInt(order) }),
      },
      include: {
        modelColors: {
          include: {
            color: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updatedModel })
  } catch (error) {
    console.error('PUT /api/device-models/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar modelo' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar modelo
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const model = await prisma.deviceModel.findUnique({
      where: { id: params.id },
    })

    if (!model) {
      return NextResponse.json(
        { success: false, error: 'Modelo não encontrado' },
        { status: 404 }
      )
    }

    await prisma.deviceModel.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Modelo deletado com sucesso',
    })
  } catch (error) {
    console.error('DELETE /api/device-models/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar modelo' },
      { status: 500 }
    )
  }
}
