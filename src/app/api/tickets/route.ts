import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import type { TicketCategory } from "@prisma/client"
import { notifyStaffNewTicket } from "@/lib/ticket-email"

export const dynamic = "force-dynamic"

const VALID_CATEGORIES: TicketCategory[] = ["BUG", "DUVIDA", "INTEGRACAO", "FINANCEIRO", "OUTRO"]

/**
 * GET /api/tickets — lista tickets do tenant logado.
 * Query params:
 *   status=OPEN|IN_PROGRESS|WAITING_CLIENT|CLOSED (opcional)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession()
    const status = req.nextUrl.searchParams.get("status") || undefined

    const tickets = await prisma.ticket.findMany({
      where: {
        tenantId: session.tenantId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        openedBy: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    })

    return NextResponse.json({ data: tickets })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[tickets GET]", err)
    return NextResponse.json({ error: "Erro ao listar tickets" }, { status: 500 })
  }
}

/**
 * POST /api/tickets — abre novo ticket. Body:
 *   { subject, body, category? }
 *
 * Cria o ticket + a primeira mensagem (CLIENT) numa transação.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession()
    const body = (await req.json()) as {
      subject?: string
      body?: string
      category?: string
    }

    const subject = body.subject?.trim()
    const messageBody = body.body?.trim()
    if (!subject) {
      return NextResponse.json({ error: "Informe um assunto" }, { status: 400 })
    }
    if (!messageBody) {
      return NextResponse.json({ error: "Descreva o problema ou dúvida" }, { status: 400 })
    }
    const category = (
      body.category && VALID_CATEGORIES.includes(body.category as TicketCategory)
        ? body.category
        : "OUTRO"
    ) as TicketCategory

    const now = new Date()
    const ticket = await prisma.ticket.create({
      data: {
        tenantId: session.tenantId,
        openedById: session.id,
        subject,
        category,
        lastClientReplyAt: now,
        messages: {
          create: {
            authorId: session.id,
            authorRole: "CLIENT",
            body: messageBody,
          },
        },
      },
      include: {
        tenant: { select: { name: true } },
        openedBy: { select: { name: true, email: true } },
      },
    })

    // Email pra equipe — fire-and-forget (não bloqueia a resposta).
    notifyStaffNewTicket({
      ticketId: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      body: messageBody,
      tenantName: ticket.tenant.name,
      authorName: ticket.openedBy.name,
      authorEmail: ticket.openedBy.email,
    }).catch((e) => console.error("[ticket-email new]", e))

    return NextResponse.json({ id: ticket.id }, { status: 201 })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[tickets POST]", err)
    return NextResponse.json({ error: "Erro ao abrir ticket" }, { status: 500 })
  }
}
