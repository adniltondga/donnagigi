import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { AuthError, authErrorResponse, requireStaff } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/staff/clientes — lista todos os tenants com info comercial
 * essencial pra atendimento: plano, status assinatura, integrações
 * conectadas, último login, contagem de tickets abertos.
 *
 * Query: q (busca em nome/slug)
 */
export async function GET(req: NextRequest) {
  try {
    await requireStaff()
    const q = req.nextUrl.searchParams.get("q")?.trim()

    const tenants = await prisma.tenant.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            value: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
          },
        },
        users: {
          select: { id: true, name: true, email: true, role: true },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            users: true,
            tickets: { where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"] } } },
            mlIntegrations: true,
            bills: true,
          },
        },
        mpIntegration: { select: { id: true } },
      },
    })

    return NextResponse.json({ data: tenants, total: tenants.length })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[staff/clientes GET]", err)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
