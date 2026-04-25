import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * Remove uma subscription pelo endpoint. Não exige autenticação
 * porque o endpoint é único e secreto (gerado pelo browser).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { endpoint?: string }
    if (!body.endpoint) {
      return NextResponse.json(
        { error: "Endpoint é obrigatório" },
        { status: 400 },
      )
    }

    await prisma.pushSubscription
      .deleteMany({ where: { endpoint: body.endpoint } })
      .catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[push/unsubscribe] erro:", error)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
