import { NextRequest, NextResponse } from "next/server"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { computeDre } from "@/lib/dre"

export const dynamic = "force-dynamic"

/**
 * GET /api/relatorios/dre?month=YYYY-MM&basis=caixa|competencia
 *
 * DRE simplificada do mês informado + comparativo vs mês anterior.
 * Lógica de cálculo mora em @/lib/dre (compartilhada com dre-anual).
 */
export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const monthParam = req.nextUrl.searchParams.get("month")
    const today = new Date()
    let year: number, month0: number
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      year = Number(monthParam.slice(0, 4))
      month0 = Number(monthParam.slice(5, 7)) - 1
    } else {
      year = today.getFullYear()
      month0 = today.getMonth()
    }

    const basis = req.nextUrl.searchParams.get("basis") === "competencia" ? "competencia" : "caixa"

    const currentDre = await computeDre(tenantId, year, month0, basis)
    const prevMonth0 = month0 === 0 ? 11 : month0 - 1
    const prevYear = month0 === 0 ? year - 1 : year
    const previousDre = await computeDre(tenantId, prevYear, prevMonth0, basis)

    return NextResponse.json({
      month: `${year}-${String(month0 + 1).padStart(2, "0")}`,
      previousMonth: `${prevYear}-${String(prevMonth0 + 1).padStart(2, "0")}`,
      basis,
      current: currentDre,
      previous: previousDre,
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[dre]", err)
    return NextResponse.json({ error: "Erro ao calcular DRE" }, { status: 500 })
  }
}
