import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { AuthError, authErrorResponse, requireStaff } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/staff/waitlist — lista signups com filtros opcionais.
 * Query: notified=true|false (opcional), source=...
 */
export async function GET(req: NextRequest) {
  try {
    await requireStaff()
    const sp = req.nextUrl.searchParams
    const notifiedParam = sp.get("notified")
    const source = sp.get("source") || undefined

    const where: Record<string, unknown> = {}
    if (notifiedParam === "true") where.notified = true
    if (notifiedParam === "false") where.notified = false
    if (source) where.source = source

    const [signups, totals] = await Promise.all([
      prisma.waitlistSignup.findMany({
        where,
        orderBy: { createdAt: "desc" },
      }),
      prisma.waitlistSignup.groupBy({
        by: ["notified"],
        _count: { _all: true },
      }),
    ])

    const stats = {
      total: totals.reduce((s, r) => s + r._count._all, 0),
      pending: totals.find((r) => !r.notified)?._count._all ?? 0,
      notified: totals.find((r) => r.notified)?._count._all ?? 0,
    }

    return NextResponse.json({ data: signups, stats })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[staff/waitlist GET]", err)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
