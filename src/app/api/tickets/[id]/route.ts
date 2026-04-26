import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/tickets/[id] — detalhe + thread do ticket.
 * Cliente só vê tickets do próprio tenant.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession()
    const ticket = await prisma.ticket.findFirst({
      where: { id: params.id, tenantId: session.tenantId },
      include: {
        openedBy: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } } },
        },
      },
    })
    if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 })
    return NextResponse.json(ticket)
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[tickets/[id] GET]", err)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
