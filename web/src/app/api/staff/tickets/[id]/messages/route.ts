import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { AuthError, authErrorResponse, requireStaff } from "@/lib/auth"
import { notifyClientStaffReply } from "@/lib/ticket-email"

export const dynamic = "force-dynamic"

/**
 * POST /api/staff/tickets/[id]/messages — staff responde no ticket.
 * Body: { body, status? } — opcionalmente atualiza status junto
 *   (ex: responder e marcar WAITING_CLIENT pra esperar info).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireStaff()
    const { body, status } = (await req.json()) as { body?: string; status?: string }
    const messageBody = body?.trim()
    if (!messageBody) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 })
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      include: {
        openedBy: { select: { name: true, email: true } },
      },
    })
    if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 })

    const now = new Date()
    // Defaults: se ticket estava OPEN/WAITING_CLIENT, vira IN_PROGRESS quando staff responde.
    const newStatus =
      status && ["OPEN", "IN_PROGRESS", "WAITING_CLIENT", "CLOSED"].includes(status)
        ? status
        : ticket.status === "OPEN"
        ? "IN_PROGRESS"
        : ticket.status

    const data: Record<string, unknown> = {
      lastStaffReplyAt: now,
      status: newStatus,
      // Atribui o staff atual se ainda não tem assignee
      ...(ticket.assigneeId ? {} : { assigneeId: session.id }),
    }
    if (newStatus === "CLOSED") data.closedAt = now

    await prisma.$transaction([
      prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: session.id,
          authorRole: "STAFF",
          body: messageBody,
        },
      }),
      prisma.ticket.update({
        where: { id: ticket.id },
        data,
      }),
    ])

    notifyClientStaffReply({
      ticketId: ticket.id,
      subject: ticket.subject,
      body: messageBody,
      toEmail: ticket.openedBy.email,
      toName: ticket.openedBy.name,
    }).catch((e) => console.error("[ticket-email staff-reply]", e))

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[staff/tickets/[id]/messages POST]", err)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
