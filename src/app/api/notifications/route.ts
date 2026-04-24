import { NextResponse } from "next/server"
import { listRecent } from "@/lib/notifications"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()
    const { items, unreadCount } = await listRecent(tenantId)
    return NextResponse.json({ items, unreadCount })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[notifications GET]", err)
    return NextResponse.json({ error: "Erro ao listar notificações" }, { status: 500 })
  }
}
