import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { notifyStaffClientReply } from "@/lib/ticket-email"

export const dynamic = "force-dynamic"

/**
 * POST /api/tickets/[id]/messages — cliente responde no ticket.
 * Body: { body: string }
 *
 * Marca status como OPEN se estava WAITING_CLIENT (cliente respondeu o que
 * o staff pediu) e atualiza `lastClientReplyAt`.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession()
    const { body } = (await req.json()) as { body?: string }
    const messageBody = body?.trim()
    if (!messageBody) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 })
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: params.id, tenantId: session.tenantId },
      include: {
        tenant: { select: { name: true } },
        openedBy: { select: { name: true } },
        assignee: { select: { email: true } },
      },
    })
    if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 })
    if (ticket.status === "CLOSED") {
      return NextResponse.json({ error: "Ticket já encerrado — abra um novo" }, { status: 400 })
    }

    const now = new Date()
    const newStatus = ticket.status === "WAITING_CLIENT" ? "OPEN" : ticket.status

    const [, updated] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: session.id,
          authorRole: "CLIENT",
          body: messageBody,
        },
      }),
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: newStatus, lastClientReplyAt: now },
      }),
    ])

    notifyStaffClientReply({
      ticketId: ticket.id,
      subject: updated.subject,
      body: messageBody,
      tenantName: ticket.tenant.name,
      authorName: ticket.openedBy.name,
      toEmail: ticket.assignee?.email,
    }).catch((e) => console.error("[ticket-email client-reply]", e))

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[tickets/[id]/messages POST]", err)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
