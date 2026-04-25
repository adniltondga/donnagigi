import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * Recebe uma PushSubscription (do navegador) e persiste por tenant.
 * Idempotente: se o endpoint já existe, atualiza p256dh/auth.
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = await getTenantIdOrDefault()

    const body = (await request.json()) as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { error: "Subscription inválida — faltam endpoint ou keys" },
        { status: 400 },
      )
    }

    const userAgent = request.headers.get("user-agent")?.slice(0, 200) || null

    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        tenantId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent,
      },
      update: {
        tenantId,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[push/subscribe] erro:", error)
    return NextResponse.json(
      { error: "Erro ao registrar subscription" },
      { status: 500 },
    )
  }
}
