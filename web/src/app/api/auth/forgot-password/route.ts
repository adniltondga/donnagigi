import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateOTP, sendEmail, resetPasswordTemplate } from "@/lib/email"

const RESEND_COOLDOWN_MS = 60 * 1000
const CODE_EXPIRES_MS = 10 * 60 * 1000

/**
 * Gera OTP de reset e envia por email. Sempre responde 200 pra não
 * vazar se email existe (anti-enumeration).
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = (await request.json()) as { email?: string }
    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, resetLastSentAt: true },
    })

    if (!user) {
      // Resposta genérica: "se existe, enviamos"
      return NextResponse.json({ ok: true })
    }

    if (
      user.resetLastSentAt &&
      Date.now() - user.resetLastSentAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      return NextResponse.json({ ok: true }) // silenciosamente ignora burst
    }

    const code = generateOTP()
    const expires = new Date(Date.now() + CODE_EXPIRES_MS)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetCode: code,
        resetCodeExpires: expires,
        resetLastSentAt: new Date(),
      },
    })

    try {
      const tpl = resetPasswordTemplate(code)
      await sendEmail({ to: email, ...tpl })
    } catch (err) {
      console.error("[forgot-password] falha ao enviar:", err)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("forgot-password error:", error)
    return NextResponse.json({ error: "Erro ao processar" }, { status: 500 })
  }
}
