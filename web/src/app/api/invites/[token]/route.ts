import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET /api/invites/[token]
 * Endpoint público pra tela de aceite. Devolve dados mínimos pra
 * mostrar quem convidou e pra qual tenant.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const invite = await prisma.invitation.findUnique({
    where: { token: params.token },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      tenant: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  })
  if (!invite) {
    return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 })
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "Convite já foi aceito" }, { status: 410 })
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Convite expirado" }, { status: 410 })
  }
  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    tenantName: invite.tenant.name,
    inviterName: invite.createdBy.name,
  })
}
