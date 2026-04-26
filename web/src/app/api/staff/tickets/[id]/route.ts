import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { AuthError, authErrorResponse, requireStaff } from "@/lib/auth"
import type { TicketPriority, TicketStatus } from "@prisma/client"

export const dynamic = "force-dynamic"

/**
 * GET /api/staff/tickets/[id] — detalhe completo (sem filtro de tenant).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireStaff()
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        openedBy: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } } },
        },
      },
    })
    if (!ticket) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
    return NextResponse.json(ticket)
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[staff/tickets/[id] GET]", err)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}

const VALID_STATUS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_CLIENT", "CLOSED"]
const VALID_PRIORITY: TicketPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"]

/**
 * PATCH /api/staff/tickets/[id] — atualiza status, prioridade ou assignee.
 * Body: { status?, priority?, assigneeId? | null }
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireStaff()
    const body = (await req.json()) as {
      status?: string
      priority?: string
      assigneeId?: string | null
    }

    const data: Record<string, unknown> = {}
    if (body.status !== undefined) {
      if (!VALID_STATUS.includes(body.status as TicketStatus)) {
        return NextResponse.json({ error: "Status inválido" }, { status: 400 })
      }
      data.status = body.status
      if (body.status === "CLOSED") data.closedAt = new Date()
      else if (body.status !== "CLOSED") data.closedAt = null
    }
    if (body.priority !== undefined) {
      if (!VALID_PRIORITY.includes(body.priority as TicketPriority)) {
        return NextResponse.json({ error: "Prioridade inválida" }, { status: 400 })
      }
      data.priority = body.priority
    }
    if (body.assigneeId !== undefined) {
      // Se passou string, valida que é um staff
      if (body.assigneeId) {
        const u = await prisma.user.findUnique({
          where: { id: body.assigneeId },
          select: { isStaff: true },
        })
        if (!u?.isStaff) return NextResponse.json({ error: "Atribuível apenas a staff" }, { status: 400 })
      }
      data.assigneeId = body.assigneeId
    }

    const updated = await prisma.ticket.update({
      where: { id: params.id },
      data,
    })
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[staff/tickets/[id] PATCH]", err)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
