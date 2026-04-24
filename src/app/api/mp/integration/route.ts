import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"
import { isWriter } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET — status da conexão OAuth com MP pro tenant logado.
 * DELETE — desconecta (OWNER/ADMIN).
 */

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const integration = await prisma.mPIntegration.findUnique({
    where: { tenantId: session.tenantId },
    select: { mpUserId: true, expiresAt: true, scope: true, updatedAt: true },
  })

  if (!integration) {
    return NextResponse.json({ configured: false })
  }

  return NextResponse.json({
    configured: true,
    mpUserId: integration.mpUserId,
    expiresAt: integration.expiresAt,
    isExpired: integration.expiresAt < new Date(),
    scope: integration.scope,
    updatedAt: integration.updatedAt,
  })
}

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  if (!isWriter(session.role)) {
    return NextResponse.json({ error: "Sem permissão pra essa ação" }, { status: 403 })
  }

  await prisma.mPIntegration.deleteMany({ where: { tenantId: session.tenantId } })
  return NextResponse.json({ ok: true })
}
