import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"
import { softDeleteAccount } from "@/lib/account-delete"
import { captureError } from "@/lib/sentry"
import { clearAuthCookie } from "@/lib/auth-session"

export const dynamic = "force-dynamic"

/**
 * Soft delete da conta (LGPD).
 *
 * Pré-condições:
 *  - Usuário logado E role=OWNER (único pode deletar tenant)
 *  - Confirma senha atual (re-auth)
 *  - Confirma palavra "DELETAR" no body
 *
 * Efeitos:
 *  - tenant.deletedAt = now
 *  - ASAAS subscription cancelada (best-effort)
 *  - AccountDeletionLog criado (snapshot pra auditoria)
 *  - Email de confirmação enviado
 *  - Cookie de sessão limpo (logout forçado)
 *  - Hard delete agendado pra +30 dias via cron
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }
    if (session.role !== "OWNER") {
      return NextResponse.json(
        { error: "Apenas o dono da conta pode excluir." },
        { status: 403 },
      )
    }

    const body = (await request.json()) as {
      password?: string
      confirmation?: string
      reason?: string
    }

    if (body.confirmation !== "DELETAR") {
      return NextResponse.json(
        { error: 'Digite "DELETAR" pra confirmar' },
        { status: 400 },
      )
    }

    if (!body.password) {
      return NextResponse.json(
        { error: "Senha é obrigatória pra confirmar" },
        { status: 400 },
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, password: true },
    })
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    const ok = await bcrypt.compare(body.password, user.password)
    if (!ok) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 })
    }

    const xff = request.headers.get("x-forwarded-for") || ""
    const ipAddress = xff.split(",")[0].trim() || null
    const userAgent = request.headers.get("user-agent")?.slice(0, 200) || null

    await softDeleteAccount({
      tenantId: session.tenantId,
      userId: session.id,
      reason: body.reason || null,
      ipAddress,
      userAgent,
    })

    // Limpa cookie de sessão (logout forçado)
    const response = NextResponse.json({ ok: true })
    clearAuthCookie(response)
    return response
  } catch (error) {
    captureError(error, { operation: "account-delete" })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro" },
      { status: 500 },
    )
  }
}
