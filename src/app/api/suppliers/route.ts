import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET all suppliers
export async function GET(_request: NextRequest) {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: [{ name: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      data: suppliers,
    })
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar fornecedores' },
      { status: 500 }
    )
  }
}

// POST create supplier
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, telephone } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Nome do fornecedor é obrigatório' },
        { status: 400 }
      )
    }

    // Check if supplier with same name already exists
    const existing = await prisma.supplier.findUnique({
      where: { name },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Fornecedor com este nome já existe' },
        { status: 400 }
      )
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        telephone: telephone || null,
      },
    })

    return NextResponse.json({
      success: true,
      data: supplier,
    })
  } catch (error) {
    console.error('Error creating supplier:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar fornecedor' },
      { status: 500 }
    )
  }
}
