import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { SignJWT } from "jose"

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Validar entrada
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios" },
        { status: 400 }
      )
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json(
        { error: "Email ou senha inválidos" },
        { status: 401 }
      )
    }

    // Validar senha
    const passwordValid = await bcrypt.compare(password, user.password)
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Email ou senha inválidos" },
        { status: 401 }
      )
    }

    // Gerar token com jose (compatível com middleware)
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "seu_jwt_secret_super_seguro"
    )

    const token = await new SignJWT({
      id: user.id,
      email: user.email
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret)

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username
      }
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "Erro ao processar login" },
      { status: 500 }
    )
  }
}
