import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { parseStartOfDayBR } from "@/lib/tz"

export const dynamic = "force-dynamic"

/**
 * Operações por id de um aporte específico.
 *
 * PATCH  /api/financeiro/aportes/{id}      → editar (amount, description, date, billCategoryId)
 * POST   /api/financeiro/aportes/{id}      → ação (action="pagar"|"reabrir"|"split")
 * DELETE /api/financeiro/aportes/{id}      → excluir
 *
 * Em qualquer rota: valida que a bill pertence ao tenant E que está na
 * hierarquia "Aporte sócio". Não permite mexer em bills de outras categorias.
 */

async function getValidAporte(tenantId: string, id: string) {
  const aporteRoot = await prisma.billCategory.findFirst({
    where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
    select: { id: true, children: { select: { id: true } } },
  })
  if (!aporteRoot) return null
  const allIds = [aporteRoot.id, ...aporteRoot.children.map((c) => c.id)]
  const bill = await prisma.bill.findFirst({
    where: { id, tenantId, billCategoryId: { in: allIds } },
    select: {
      id: true,
      amount: true,
      status: true,
      dueDate: true,
      paidDate: true,
      description: true,
      billCategoryId: true,
      notes: true,
    },
  })
  return bill
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()
    const { id } = await ctx.params

    const bill = await getValidAporte(tenantId, id)
    if (!bill) {
      return NextResponse.json({ error: "Aporte não encontrado" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const updates: {
      amount?: number
      description?: string
      dueDate?: Date
      billCategoryId?: string
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
      updates.dueDate = parseStartOfDayBR(body.date)
    }
    if (typeof body?.billCategoryId === "string") {
      // Valida que a nova categoria também é da hierarquia Aporte sócio.
      const aporteRoot = await prisma.billCategory.findFirst({
        where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
        select: { id: true, children: { select: { id: true, name: true } } },
      })
      const validIds = aporteRoot
        ? [
            aporteRoot.id,
            ...aporteRoot.children
              .filter((c) => c.name !== "Amortização")
              .map((c) => c.id),
          ]
        : []
      if (!validIds.includes(body.billCategoryId)) {
        return NextResponse.json(
          { error: "Categoria inválida pra aporte" },
          { status: 400 },
        )
      }
      updates.billCategoryId = body.billCategoryId
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada pra atualizar" }, { status: 400 })
    }

    await prisma.bill.update({ where: { id }, data: updates })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[aportes/{id} PATCH]", err)
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()
    const { id } = await ctx.params

    const bill = await getValidAporte(tenantId, id)
    if (!bill) {
      return NextResponse.json({ error: "Aporte não encontrado" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const action: string = body?.action

    if (action === "pagar") {
      if (bill.status === "paid") {
        return NextResponse.json({ error: "Aporte já está pago" }, { status: 400 })
      }
      const dateStr: string | undefined =
        typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
          ? body.date
          : undefined
      const paidDate = dateStr ? parseStartOfDayBR(dateStr) : new Date()
      await prisma.bill.update({
        where: { id },
        data: { status: "paid", paidDate },
      })
      return NextResponse.json({ ok: true })
    }

    if (action === "reabrir") {
      if (bill.status !== "paid") {
        return NextResponse.json({ error: "Aporte não está pago" }, { status: 400 })
      }
      await prisma.bill.update({
        where: { id },
        data: { status: "pending", paidDate: null },
      })
      return NextResponse.json({ ok: true })
    }

    if (action === "split") {
      // Divide o aporte em 2: [valor pago | restante pendente]
      const valorPago = Number(body?.valorPago)
      if (!Number.isFinite(valorPago) || valorPago <= 0 || valorPago >= bill.amount) {
        return NextResponse.json(
          { error: "Valor pago inválido (deve ser maior que 0 e menor que o total)" },
          { status: 400 },
        )
      }
      const dateStr: string | undefined =
        typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
          ? body.date
          : undefined
      const paidDate = dateStr ? parseStartOfDayBR(dateStr) : new Date()

      await prisma.$transaction(async (tx) => {
        const original = await tx.bill.findUnique({
          where: { id },
          select: {
            tenantId: true,
            type: true,
            description: true,
            dueDate: true,
            billCategoryId: true,
            category: true,
            supplierId: true,
            productId: true,
            notes: true,
          },
        })
        if (!original) return
        await tx.bill.update({
          where: { id },
          data: {
            amount: valorPago,
            status: "paid",
            paidDate,
            notes: [original.notes, "[split — parte paga]"]
              .filter(Boolean)
              .join(" · "),
          },
        })
        await tx.bill.create({
          data: {
            tenantId: original.tenantId,
            type: original.type,
            status: "pending",
            category: original.category,
            billCategoryId: original.billCategoryId,
            description: original.description,
            amount: bill.amount - valorPago,
            dueDate: original.dueDate,
            supplierId: original.supplierId,
            productId: original.productId,
            notes: [original.notes, "[split — saldo pendente]"]
              .filter(Boolean)
              .join(" · "),
          },
        })
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[aportes/{id} POST]", err)
    return NextResponse.json({ error: "Erro ao executar ação" }, { status: 500 })
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

    const bill = await getValidAporte(tenantId, id)
    if (!bill) {
      return NextResponse.json({ error: "Aporte não encontrado" }, { status: 404 })
    }

    await prisma.bill.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[aportes/{id} DELETE]", err)
    return NextResponse.json({ error: "Erro ao excluir" }, { status: 500 })
  }
}
