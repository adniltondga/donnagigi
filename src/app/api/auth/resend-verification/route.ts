import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateOTP, sendEmail, verifyEmailTemplate } from "@/lib/email"
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit"

const RESEND_COOLDOWN_MS = 60 * 1000 // 60s entre reenvios
const CODE_EXPIRES_MS = 10 * 60 * 1000 // 10 min

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimitResponse(checkRateLimit(request, RATE_LIMITS.resendVerification))
    if (limited) return limited

    const { email } = (await request.json()) as { email?: string }
    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerified: true,
        verifyLastSentAt: true,
      },
    })

    // Resposta genérica pra não vazar se email existe
    if (!user || user.emailVerified) {
      return NextResponse.json({ ok: true })
    }

    if (
      user.verifyLastSentAt &&
      Date.now() - user.verifyLastSentAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      const retry = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - user.verifyLastSentAt.getTime())) / 1000
      )
      return NextResponse.json(
        { error: `Aguarde ${retry}s para reenviar` },
        { status: 429 }
      )
    }

    const code = generateOTP()
    const expires = new Date(Date.now() + CODE_EXPIRES_MS)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyCode: code,
        verifyCodeExpires: expires,
        verifyLastSentAt: new Date(),
      },
    })

    try {
      const tpl = verifyEmailTemplate(code)
      await sendEmail({ to: email, ...tpl })
    } catch (err) {
      console.error("[resend-verification] falha ao enviar:", err)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("resend-verification error:", error)
    return NextResponse.json({ error: "Erro ao reenviar" }, { status: 500 })
  }
}
