import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit"
import { issueSession, setAuthCookie } from "@/lib/auth-session"

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimitResponse(checkRateLimit(request, RATE_LIMITS.login))
    if (limited) return limited

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios" },
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
        password: true,
        role: true,
        tenantId: true,
        emailVerified: true,
        isStaff: true,
        tenant: { select: { id: true, name: true, slug: true, deletedAt: true } },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Email ou senha inválidos" },
        { status: 401 }
      )
    }

    const passwordValid = await bcrypt.compare(password, user.password)
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Email ou senha inválidos" },
        { status: 401 }
      )
    }

    // Tenant em soft-delete: bloqueia login e oferece restore
    if (user.tenant.deletedAt) {
      return NextResponse.json(
        {
          error: "ACCOUNT_DELETED",
          message: "Sua conta foi excluída. Você pode restaurar até 30 dias após a exclusão.",
          canRestore: user.role === "OWNER",
          deletedAt: user.tenant.deletedAt.toISOString(),
        },
        { status: 410 }
      )
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        {
          error: "EMAIL_NOT_VERIFIED",
          message: "Ative sua conta pelo código enviado por email",
        },
        { status: 403 }
      )
    }

    const { token } = await issueSession({
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
        isStaff: user.isStaff,
      },
      request,
      alertOnNewDevice: true,
    })

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        isStaff: user.isStaff,
      },
      tenant: user.tenant,
      // Retornado também no body pra mobile (Bearer). Web ignora e usa o cookie.
      token,
    })
    setAuthCookie(response, token)
    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "Erro ao processar login" },
      { status: 500 }
    )
  }
}
