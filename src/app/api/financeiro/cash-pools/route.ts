import { NextRequest, NextResponse } from "next/server"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { calcularCaixas } from "@/lib/cash-pools"

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
    const start = startStr ? new Date(`${startStr}T00:00:00`) : undefined
    const end = endStr ? new Date(`${endStr}T00:00:00`) : undefined

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
