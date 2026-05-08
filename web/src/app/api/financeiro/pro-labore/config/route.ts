import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/financeiro/pro-labore/config
 * Body: { proLaborePct: number }  (0..100)
 *
 * Atualiza o % do caixa do mês (líquido de saídas pra sócio) que vira
 * pró-labore retirável. Default 100. Ajustar pra 80 = retirar 80%, deixar 20%.
 */
export async function PATCH(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const body = await req.json().catch(() => null)
    const pct = Number(body?.proLaborePct)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return NextResponse.json(
        { error: "proLaborePct precisa estar entre 0 e 100" },
        { status: 400 },
      )
    }

    const result = await prisma.financialSettings.upsert({
      where: { tenantId },
      update: { proLaborePct: pct },
      create: { tenantId, proLaborePct: pct },
      select: { proLaborePct: true },
    })

    return NextResponse.json({ ok: true, proLaborePct: result.proLaborePct })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[pro-labore/config]", err)
    return NextResponse.json({ error: "Erro ao salvar configuração" }, { status: 500 })
  }
}
