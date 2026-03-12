import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET - Detalhes de uma cor
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const color = await prisma.deviceColor.findUnique({
      where: { id: params.id },
      include: {
        modelColors: {
          include: {
            model: true,
          },
        },
      },
    })

    if (!color) {
      return NextResponse.json(
        { success: false, error: 'Cor não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: color })
  } catch (error) {
    console.error('GET /api/device-colors/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar cor' },
      { status: 500 }
    )
  }
}

// PUT - Editar cor
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { name, hexColor, active, order } = body

    // Verificar se cor existe
    const existingColor = await prisma.deviceColor.findUnique({
      where: { id: params.id },
    })

    if (!existingColor) {
      return NextResponse.json(
        { success: false, error: 'Cor não encontrada' },
        { status: 404 }
      )
    }

    // Se mudar nome, verificar duplicata
    if (name && name !== existingColor.name) {
      const duplicate = await prisma.deviceColor.findUnique({
        where: { name },
      })
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'Cor com este nome já existe' },
          { status: 400 }
        )
      }
    }

    const updatedColor = await prisma.deviceColor.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(hexColor && { hexColor }),
        ...(active !== undefined && { active }),
        ...(order !== undefined && { order: parseInt(order) }),
      },
      include: {
        modelColors: {
          include: {
            model: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updatedColor })
  } catch (error) {
    console.error('PUT /api/device-colors/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar cor' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar cor
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const color = await prisma.deviceColor.findUnique({
      where: { id: params.id },
    })

    if (!color) {
      return NextResponse.json(
        { success: false, error: 'Cor não encontrada' },
        { status: 404 }
      )
    }

    await prisma.deviceColor.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Cor deletada com sucesso',
    })
  } catch (error) {
    console.error('DELETE /api/device-colors/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar cor' },
      { status: 500 }
    )
  }
}
