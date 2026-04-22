import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { email, username, password, name } = await request.json()

    // Validar entrada
    if (!email || !username || !password || !name) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios" },
        { status: 400 }
      )
    }

    // Verificar se usuário já existe
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Email ou username já cadastrado" },
        { status: 409 }
      )
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10)

    // Criar usuário (por enquanto associado ao tenant default — Fase 3
    // de auth vai criar um Tenant novo pra cada signup)
    const { getDefaultTenantId } = await import('@/lib/tenant')
    const tenantId = await getDefaultTenantId()
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        name,
        tenantId,
      }
    })

    return NextResponse.json(
      {
        message: "Usuário criado com sucesso",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json(
      { error: "Erro ao criar usuário" },
      { status: 500 }
    )
  }
}
