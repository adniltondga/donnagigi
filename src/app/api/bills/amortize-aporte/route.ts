import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireRole } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/bills/amortize-aporte
 * Body: { amount: number }
 *
 * Amortiza X reais dos aportes pendentes. Aplica FIFO (mais antigos
 * primeiro). Se o valor não cobrir a última bill inteira, DIVIDE ela:
 * mantém a original reduzida (pending) e cria outra com o valor pago.
 *
 * Retorna: { ok, totalPaid, billsAffected, remaining }
 * — remaining > 0 significa que não tinha aporte pendente suficiente.
 */
export async function POST(req: NextRequest) {
  try {
    await requireRole(["OWNER", "ADMIN"])
    const body = await req.json()
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
    }

    const tenantId = await getTenantIdOrDefault()

    const root = await prisma.billCategory.findFirst({
      where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
      include: { children: { select: { id: true } } },
    })
    if (!root) {
      return NextResponse.json(
        { error: 'Categoria "Aporte sócio" não encontrada' },
        { status: 404 }
      )
    }
    const aporteIds = [root.id, ...root.children.map((c) => c.id)]

    // FIFO: aportes pendentes mais antigos primeiro
    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        status: "pending",
        billCategoryId: { in: aporteIds },
      },
      orderBy: { dueDate: "asc" },
    })

    let remaining = amount
    let totalPaid = 0
    const affected: Array<{ id: string; paid: number; split: boolean }> = []
    const now = new Date()
    const EPS = 0.005 // 1 centavo de tolerância

    for (const bill of bills) {
      if (remaining <= EPS) break

      if (remaining >= bill.amount - EPS) {
        // Quita a bill inteira
        await prisma.bill.update({
          where: { id: bill.id },
          data: { status: "paid", paidDate: now },
        })
        totalPaid += bill.amount
        remaining -= bill.amount
        affected.push({ id: bill.id, paid: bill.amount, split: false })
      } else {
        // Divide: reduz a original pro saldo remanescente, cria uma nova com o pago
        const paidPortion = Math.round(remaining * 100) / 100
        const pendingLeft = Math.round((bill.amount - paidPortion) * 100) / 100

        await prisma.$transaction([
          prisma.bill.update({
            where: { id: bill.id },
            data: { amount: pendingLeft },
          }),
          prisma.bill.create({
            data: {
              type: bill.type,
              description: `${bill.description} (amortização)`,
              amount: paidPortion,
              dueDate: bill.dueDate,
              paidDate: now,
              status: "paid",
              category: bill.category,
              billCategoryId: bill.billCategoryId,
              supplierId: bill.supplierId,
              productId: bill.productId,
              notes: bill.notes,
              productCost: null,
              mlOrderId: null, // unique — nunca duplica
              quantity: 1,
              tenantId,
            },
          }),
        ])
        totalPaid += paidPortion
        remaining = 0
        affected.push({ id: bill.id, paid: paidPortion, split: true })
      }
    }

    return NextResponse.json({
      ok: true,
      totalPaid: Math.round(totalPaid * 100) / 100,
      billsAffected: affected.length,
      remaining: Math.round(remaining * 100) / 100,
      details: affected,
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[amortize-aporte]", err)
    return NextResponse.json({ error: "Erro ao amortizar" }, { status: 500 })
  }
}
