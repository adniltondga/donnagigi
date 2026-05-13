import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * Recebe um ExponentPushToken do app mobile e persiste por tenant+user.
 * Idempotente: se o token já existe, atualiza tenant/user/metadata.
 *
 * Exige sessão (cookie ou header `Cookie: token=<jwt>` enviado pelo app).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()

    const body = (await request.json()) as {
      token?: string
      deviceName?: string
      platform?: string
    }

    if (!body.token || typeof body.token !== "string") {
      return NextResponse.json(
        { error: "Token é obrigatório" },
        { status: 400 },
      )
    }

    const validPrefix =
      body.token.startsWith("ExponentPushToken[") ||
      body.token.startsWith("ExpoPushToken[")
    if (!validPrefix) {
      return NextResponse.json(
        { error: "Formato de token inválido" },
        { status: 400 },
      )
    }

    await prisma.expoPushSubscription.upsert({
      where: { token: body.token },
      create: {
        tenantId: session.tenantId,
        userId: session.id,
        token: body.token,
        deviceName: body.deviceName ?? null,
        platform: body.platform ?? null,
      },
      update: {
        tenantId: session.tenantId,
        userId: session.id,
        deviceName: body.deviceName ?? null,
        platform: body.platform ?? null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[push/expo/subscribe] erro:", err)
    return NextResponse.json(
      { error: "Erro ao registrar token" },
      { status: 500 },
    )
  }
}
