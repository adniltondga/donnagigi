import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireRole, authErrorResponse } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * DELETE /api/team/invites/[id] — cancela (revoga) um convite pendente.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["OWNER", "ADMIN"])
    const invite = await prisma.invitation.findUnique({
      where: { id: params.id },
      select: { id: true, tenantId: true, acceptedAt: true },
    })
    if (!invite || invite.tenantId !== session.tenantId) {
      return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 })
    }
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "Convite já foi aceito" }, { status: 400 })
    }
    await prisma.invitation.delete({ where: { id: invite.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return authErrorResponse(e)
  }
}
