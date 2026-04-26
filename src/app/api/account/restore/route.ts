import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { SignJWT } from "jose"
import prisma from "@/lib/prisma"
import { restoreAccount } from "@/lib/account-delete"
import { captureError } from "@/lib/sentry"

export const dynamic = "force-dynamic"

/**
 * Restaura uma conta soft-deletada. Como o user perdeu a sessão ao
 * deletar, exigimos credenciais (email + senha) novamente.
 *
 * Só funciona se tenant ainda está em soft-delete (deletedAt setado
 * E hard delete ainda não rolou).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string
      password?: string
    }

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios" },
        { status: 400 },
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        tenantId: true,
        tenant: {
          select: { id: true, name: true, deletedAt: true, slug: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Email ou senha inválidos" }, { status: 401 })
    }

    const ok = await bcrypt.compare(body.password, user.password)
    if (!ok) {
      return NextResponse.json({ error: "Email ou senha inválidos" }, { status: 401 })
    }

    if (user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Apenas o dono da conta pode restaurá-la" },
        { status: 403 },
      )
    }

    if (!user.tenant.deletedAt) {
      return NextResponse.json(
        { error: "Essa conta não está excluída" },
        { status: 400 },
      )
    }

    await restoreAccount({ tenantId: user.tenantId })

    // Re-emite token (login automático)
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "seu_jwt_secret_super_seguro",
    )
    const token = await new SignJWT({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret)

    return NextResponse.json({
      ok: true,
      token,
      tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug },
    })
  } catch (error) {
    captureError(error, { operation: "account-restore" })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro" },
      { status: 500 },
    )
  }
}
