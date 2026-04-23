import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { SignJWT } from "jose"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

function genUsername(email: string): string {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "")
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base || "user"}-${suffix}`
}

/**
 * POST /api/invites/[token]/accept
 * Body: { name, password }
 * Cria o User, marca convite aceito e loga (cookie + token no body).
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await req.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (name.length < 2) {
      return NextResponse.json({ error: "Informe seu nome completo" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Senha precisa ter ao menos 6 caracteres" }, { status: 400 })
    }

    const invite = await prisma.invitation.findUnique({
      where: { token: params.token },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        expiresAt: true,
        acceptedAt: true,
      },
    })
    if (!invite) {
      return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 })
    }
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "Convite já foi aceito" }, { status: 410 })
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Convite expirado" }, { status: 410 })
    }

    const emailTaken = await prisma.user.findUnique({ where: { email: invite.email } })
    if (emailTaken) {
      return NextResponse.json({ error: "Esse email já tem conta. Faça login." }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 10)
    // Gera um username único (simples: base do email + sufixo random, retry em caso de colisão)
    let username = genUsername(invite.email)
    for (let i = 0; i < 4; i++) {
      const clash = await prisma.user.findUnique({ where: { username } })
      if (!clash) break
      username = genUsername(invite.email)
    }

    const user = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invite.email,
          username,
          name,
          password: hashed,
          role: invite.role,
          tenantId: invite.tenantId,
          emailVerified: true, // o convite já comprova que o email é dele
        },
      })
      await tx.invitation.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      })
      return user
    })

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "seu_jwt_secret_super_seguro")
    const token = await new SignJWT({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret)

    const res = NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, username: user.username, role: user.role },
    })
    res.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    })
    return res
  } catch (err) {
    console.error("[invites/accept]", err)
    return NextResponse.json({ error: "Erro ao aceitar convite" }, { status: 500 })
  }
}
