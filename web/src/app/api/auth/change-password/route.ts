import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * Troca a senha do usuário logado. Valida a senha atual antes de aplicar.
 * Requer:
 *  - currentPassword
 *  - newPassword (mínimo 6 chars)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword?: string
      newPassword?: string
    }

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Senha atual e nova senha são obrigatórias" },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "A nova senha precisa ter ao menos 6 caracteres" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, password: true },
    })
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) {
      return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 })
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "A nova senha precisa ser diferente da atual" },
        { status: 400 }
      )
    }

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("change-password error:", error)
    return NextResponse.json({ error: "Erro ao trocar senha" }, { status: 500 })
  }
}
