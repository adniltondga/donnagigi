import { NextRequest, NextResponse } from "next/server"
import { SignJWT } from "jose"
import prisma from "@/lib/prisma"

/**
 * Valida OTP de ativação de email. Se bate, marca emailVerified=true e
 * retorna o JWT — o usuário já entra direto no dashboard.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, code } = (await request.json()) as {
      email?: string
      code?: string
    }

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email e código são obrigatórios" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        tenantId: true,
        emailVerified: true,
        verifyCode: true,
        verifyCodeExpires: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email já verificado — faça login" },
        { status: 400 }
      )
    }

    if (!user.verifyCode || !user.verifyCodeExpires) {
      return NextResponse.json(
        { error: "Nenhum código ativo — solicite um novo" },
        { status: 400 }
      )
    }

    if (user.verifyCodeExpires < new Date()) {
      return NextResponse.json(
        { error: "Código expirado — solicite um novo" },
        { status: 400 }
      )
    }

    if (user.verifyCode !== code.trim()) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 })
    }

    // Marca como verificado e limpa o code
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verifyCode: null,
        verifyCodeExpires: null,
      },
    })

    // Emite JWT pra loga automática
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "seu_jwt_secret_super_seguro"
    )
    const token = await new SignJWT({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
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
        username: user.username,
      },
      tenant: user.tenant,
    })
  } catch (error) {
    console.error("verify-email error:", error)
    return NextResponse.json({ error: "Erro ao verificar" }, { status: 500 })
  }
}
