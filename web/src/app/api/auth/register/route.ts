import { hash } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email, username, password, name } = await request.json()

    // Validar campos
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: 'Email, username e password são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se usuário já existe
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email ou username já está em uso' },
        { status: 409 }
      )
    }

    // Hash da senha
    const hashedPassword = await hash(password, 10)

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        name: name || username
      }
    })

    return NextResponse.json(
      {
        message: 'Usuário criado com sucesso',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro ao registrar:', error)
    return NextResponse.json(
      { error: 'Erro ao crear conta' },
      { status: 500 }
    )
  }
}
