import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireRole, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET: lê settings do tenant. Se não existir, cria com defaults (3 meses,
 * 20%) e retorna.
 * PATCH: atualiza (OWNER/ADMIN). Body aceita reservaMeses, reinvestPct,
 * saldoCaixaAtual (números) — só altera o que for enviado.
 */

export async function GET() {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    let settings = await prisma.financialSettings.findUnique({ where: { tenantId } })
    if (!settings) {
      settings = await prisma.financialSettings.create({
        data: { tenantId },
      })
    }
    return NextResponse.json(settings)
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[financial-settings GET]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireRole(["OWNER", "ADMIN"])
    const tenantId = await getTenantIdOrDefault()
    const body = await req.json()

    const data: {
      reservaMeses?: number
      reinvestPct?: number
      saldoCaixaAtual?: number | null
      saldoAtualizadoEm?: Date | null
    } = {}

    if (body.reservaMeses !== undefined) {
      const n = Math.max(0, Math.min(24, Number(body.reservaMeses)))
      if (Number.isFinite(n)) data.reservaMeses = Math.round(n)
    }
    if (body.reinvestPct !== undefined) {
      const n = Math.max(0, Math.min(100, Number(body.reinvestPct)))
      if (Number.isFinite(n)) data.reinvestPct = n
    }
    if (body.saldoCaixaAtual !== undefined) {
      if (body.saldoCaixaAtual === null || body.saldoCaixaAtual === "") {
        data.saldoCaixaAtual = null
        data.saldoAtualizadoEm = null
      } else {
        const n = Number(body.saldoCaixaAtual)
        if (Number.isFinite(n) && n >= 0) {
          data.saldoCaixaAtual = n
          data.saldoAtualizadoEm = new Date()
        }
      }
    }

    const settings = await prisma.financialSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    })
    return NextResponse.json(settings)
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[financial-settings PATCH]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
