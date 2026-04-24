import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { computeDre, sumDreResults, type DreResult } from "@/lib/dre"

export const dynamic = "force-dynamic"

/**
 * GET /api/relatorios/dre-anual?year=YYYY&basis=caixa|competencia
 *
 * DRE matricial do ano: 12 meses + total YTD.
 * availableYears vem de min/max de paidDate e dueDate em Bill do tenant.
 */
export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const yearParam = req.nextUrl.searchParams.get("year")
    const today = new Date()
    const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : today.getFullYear()
    const basis = req.nextUrl.searchParams.get("basis") === "competencia" ? "competencia" : "caixa"

    const bounds = await prisma.bill.aggregate({
      where: { tenantId },
      _min: { paidDate: true, dueDate: true, createdAt: true },
      _max: { paidDate: true, dueDate: true, createdAt: true },
    })
    const candidates = [
      bounds._min.paidDate,
      bounds._min.dueDate,
      bounds._min.createdAt,
      bounds._max.paidDate,
      bounds._max.dueDate,
      bounds._max.createdAt,
    ]
      .filter((d): d is Date => d != null)
      .map((d) => d.getFullYear())
    const minYear = candidates.length > 0 ? Math.min(...candidates) : today.getFullYear()
    const maxYear = Math.max(today.getFullYear(), ...(candidates.length > 0 ? candidates : [today.getFullYear()]))
    const availableYears: number[] = []
    for (let y = minYear; y <= maxYear; y++) availableYears.push(y)

    const monthsResults: DreResult[] = []
    for (let m = 0; m < 12; m++) {
      monthsResults.push(await computeDre(tenantId, year, m, basis))
    }
    const total = sumDreResults(monthsResults)

    return NextResponse.json({
      year,
      basis,
      availableYears,
      months: monthsResults.map((dre, i) => ({ month: i + 1, dre })),
      total,
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[dre-anual]", err)
    return NextResponse.json({ error: "Erro ao calcular DRE anual" }, { status: 500 })
  }
}
