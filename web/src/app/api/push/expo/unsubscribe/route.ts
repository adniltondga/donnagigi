import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * Remove um ExpoPushSubscription pelo token. Não exige sessão porque o
 * token é único e secreto — espelha o comportamento de
 * /api/push/unsubscribe (Web Push).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string }
    if (!body.token) {
      return NextResponse.json(
        { error: "Token é obrigatório" },
        { status: 400 },
      )
    }

    await prisma.expoPushSubscription
      .deleteMany({ where: { token: body.token } })
      .catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[push/expo/unsubscribe] erro:", err)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
