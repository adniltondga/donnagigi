import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { AuthError, authErrorResponse, requireStaff } from "@/lib/auth"
import type { TicketStatus } from "@prisma/client"

export const dynamic = "force-dynamic"

/**
 * GET /api/staff/tickets — lista TODOS os tickets, com filtros.
 * Query:
 *   status, assigneeId, q (busca em subject)
 */
export async function GET(req: NextRequest) {
  try {
    await requireStaff()
    const sp = req.nextUrl.searchParams
    const status = sp.get("status") as TicketStatus | null
    const assigneeId = sp.get("assigneeId") || undefined
    const q = sp.get("q")?.trim()

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (assigneeId === "unassigned") where.assigneeId = null
    else if (assigneeId) where.assigneeId = assigneeId
    if (q) where.subject = { contains: q, mode: "insensitive" }

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: [
        { status: "asc" }, // OPEN primeiro alfabeticamente, depois IN_PROGRESS, etc
        { updatedAt: "desc" },
      ],
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        openedBy: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    })

    return NextResponse.json({ data: tickets })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[staff/tickets GET]", err)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
