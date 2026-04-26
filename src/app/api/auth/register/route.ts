import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { generateUniqueTenantSlug } from "@/lib/tenant"
import { generateOTP, sendEmail, verifyEmailTemplate } from "@/lib/email"
import { TRIAL_DAYS } from "@/lib/plans"
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit"
import { isRegistrationOpen } from "@/lib/registration"

// Sempre runtime — não cachear status do registro.
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // Cadastro fechado em prod enquanto sistema está em testes finais.
    if (!isRegistrationOpen()) {
      return NextResponse.json(
        {
          error: "REGISTRATION_CLOSED",
          message:
            "Cadastros temporariamente fechados — estamos em testes finais. Entre na lista de espera pra ser avisado quando abrir.",
        },
        { status: 403 }
      )
    }

    const limited = rateLimitResponse(checkRateLimit(request, RATE_LIMITS.register))
    if (limited) return limited

    const body = await request.json()
    const { email, username, password, name, companyName } = body as {
      email?: string
      username?: string
      password?: string
      name?: string
      companyName?: string
    }

    if (!email || !username || !password || !name) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Senha precisa ter ao menos 6 caracteres" },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Email ou username já cadastrado" },
        { status: 409 }
      )
    }

    const tenantName = (companyName?.trim() || name).slice(0, 100)
    const slug = await generateUniqueTenantSlug(tenantName)
    const hashedPassword = await bcrypt.hash(password, 10)

    // OTP de ativação: 10 minutos de validade
    const verifyCode = generateOTP()
    const verifyCodeExpires = new Date(Date.now() + 10 * 60 * 1000)

    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS)

    const { user, tenant } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: tenantName, slug },
      })
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: "FREE",
          status: "TRIAL",
          trialEndsAt,
        },
      })
      const user = await tx.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          name,
          role: "OWNER",
          tenantId: tenant.id,
          emailVerified: false,
          verifyCode,
          verifyCodeExpires,
          verifyLastSentAt: new Date(),
        },
      })
      return { user, tenant }
    })

    // Envia email de ativação (best-effort: não falha o cadastro se o email der erro)
    try {
      const tpl = verifyEmailTemplate(verifyCode)
      await sendEmail({ to: email, ...tpl })
    } catch (err) {
      console.error("[register] falha ao enviar email de verificação:", err)
    }

    return NextResponse.json(
      {
        message: "Conta criada. Verifique seu email para ativar.",
        email: user.email,
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json(
      { error: "Erro ao criar conta" },
      { status: 500 }
    )
  }
}
