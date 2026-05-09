import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit"
import { revokeAllUserSessions } from "@/lib/auth-session"

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimitResponse(checkRateLimit(request, RATE_LIMITS.resetPassword))
    if (limited) return limited

    const { email, code, newPassword } = (await request.json()) as {
      email?: string
      code?: string
      newPassword?: string
    }

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { error: "Email, código e nova senha são obrigatórios" },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Senha precisa ter ao menos 6 caracteres" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        resetCode: true,
        resetCodeExpires: true,
      },
    })

    if (!user || !user.resetCode || !user.resetCodeExpires) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 })
    }

    if (user.resetCodeExpires < new Date()) {
      return NextResponse.json(
        { error: "Código expirado — solicite um novo" },
        { status: 400 }
      )
    }

    if (user.resetCode !== code.trim()) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 })
    }

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        resetCode: null,
        resetCodeExpires: null,
        // Garante que um reset efetivo marca o email como verificado
        emailVerified: true,
      },
    })

    // Reset por OTP é forte sinal de comprometimento — derruba TODAS as
    // sessões ativas. Usuário precisa relogar com a nova senha.
    await revokeAllUserSessions(user.id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("reset-password error:", error)
    return NextResponse.json({ error: "Erro ao redefinir senha" }, { status: 500 })
  }
}
