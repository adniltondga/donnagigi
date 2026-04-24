import { NextResponse } from "next/server"
import { markAllRead } from "@/lib/notifications"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()
    await markAllRead(tenantId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[notifications POST read-all]", err)
    return NextResponse.json({ error: "Erro ao marcar todas como lidas" }, { status: 500 })
  }
}
