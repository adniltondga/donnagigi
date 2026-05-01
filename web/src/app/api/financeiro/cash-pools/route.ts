import { NextRequest, NextResponse } from "next/server"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { calcularCaixas } from "@/lib/cash-pools"
import { parseStartOfDayBR, parseEndOfDayBR } from "@/lib/tz"

export const dynamic = "force-dynamic"

/**
 * GET /api/financeiro/cash-pools?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Retorna saldo das caixas virtuais no período (default: mês corrente).
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantIdOrDefault()
    const sp = req.nextUrl.searchParams
    const startStr = sp.get("start")
    const endStr = sp.get("end")
    const start = startStr ? parseStartOfDayBR(startStr) : undefined
    // end é inclusive na UI ("até 31/05") mas calcularCaixas usa lt (exclusive),
    // então mando o instante seguinte ao fim do dia.
    const end = endStr ? new Date(parseEndOfDayBR(endStr).getTime() + 1) : undefined

    const result = await calcularCaixas({ tenantId, start, end })
    return NextResponse.json(result)
  } catch (error) {
    console.error("[cash-pools] erro:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "erro" },
      { status: 500 },
    )
  }
}
