import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { REPOSICAO_CATEGORY } from "@/lib/cash-pools"
import { parseStartOfDayBR } from "@/lib/tz"

export const dynamic = "force-dynamic"

/**
 * Operações por id de uma reposição.
 *
 * PATCH  /api/financeiro/reposicao/{id}  → editar (amount, description, date)
 * DELETE /api/financeiro/reposicao/{id}  → excluir
 *
 * Sempre valida que a bill é category=reposicao_estoque do tenant.
 */

async function getValidReposicao(tenantId: string, id: string) {
  return prisma.bill.findFirst({
    where: { id, tenantId, type: "payable", category: REPOSICAO_CATEGORY },
    select: {
      id: true,
      amount: true,
      description: true,
      paidDate: true,
      dueDate: true,
    },
  })
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()
    const { id } = await ctx.params

    const bill = await getValidReposicao(tenantId, id)
    if (!bill) {
      return NextResponse.json({ error: "Reposição não encontrada" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const updates: {
      amount?: number
      description?: string
      dueDate?: Date
      paidDate?: Date
    } = {}

    if (body?.amount !== undefined) {
      const n = Number(body.amount)
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
      }
      updates.amount = n
    }
    if (typeof body?.description === "string" && body.description.trim().length > 0) {
      updates.description = body.description.trim()
    }
    if (typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      const d = parseStartOfDayBR(body.date)
      updates.dueDate = d
      updates.paidDate = d
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada pra atualizar" }, { status: 400 })
    }

    await prisma.bill.update({ where: { id }, data: updates })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[reposicao/{id} PATCH]", err)
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()
    const { id } = await ctx.params

    const bill = await getValidReposicao(tenantId, id)
    if (!bill) {
      return NextResponse.json({ error: "Reposição não encontrada" }, { status: 404 })
    }

    await prisma.bill.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[reposicao/{id} DELETE]", err)
    return NextResponse.json({ error: "Erro ao excluir" }, { status: 500 })
  }
}
