import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface Params {
  params: Promise<{ id: string }>
}

// GET single supplier
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    const supplier = await prisma.supplier.findUnique({
      where: { id },
    })

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: 'Fornecedor não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: supplier,
    })
  } catch (error) {
    console.error('Error fetching supplier:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar fornecedor' },
      { status: 500 }
    )
  }
}

// PUT update supplier
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, telephone } = body

    // Check if supplier exists
    const existing = await prisma.supplier.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Fornecedor não encontrado' },
        { status: 404 }
      )
    }

    // Check if new name is unique (if changed)
    if (name && name !== existing.name) {
      const duplicate = await prisma.supplier.findUnique({
        where: { name },
      })

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'Fornecedor com este nome já existe' },
          { status: 400 }
        )
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name && { name }),
        telephone: telephone !== undefined ? telephone : existing.telephone,
      },
    })

    return NextResponse.json({
      success: true,
      data: supplier,
    })
  } catch (error) {
    console.error('Error updating supplier:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar fornecedor' },
      { status: 500 }
    )
  }
}

// DELETE supplier
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Check if supplier exists
    const existing = await prisma.supplier.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Fornecedor não encontrado' },
        { status: 404 }
      )
    }

    await prisma.supplier.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Fornecedor deletado com sucesso',
    })
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar fornecedor' },
      { status: 500 }
    )
  }
}
