import { NextResponse } from "next/server"
import { markOneRead } from "@/lib/notifications"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()
    await markOneRead(tenantId, params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[notifications PATCH read]", err)
    return NextResponse.json({ error: "Erro ao marcar como lida" }, { status: 500 })
  }
}
