import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/waitlist  body: { email, source? }
 * Captura email pra avisar quando o sistema abrir cadastro.
 * Idempotente: re-envio do mesmo email retorna 200 sem duplicar.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const source =
      typeof body.source === "string" ? body.source.slice(0, 32) : null

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 })
    }

    const existing = await prisma.waitlistSignup.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ ok: true, alreadyRegistered: true })
    }

    await prisma.waitlistSignup.create({
      data: { email, source },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[waitlist POST]", err)
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 })
  }
}
