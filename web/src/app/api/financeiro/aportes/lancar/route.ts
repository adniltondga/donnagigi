import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { parseStartOfDayBR } from "@/lib/tz"

export const dynamic = "force-dynamic"

/**
 * POST /api/financeiro/aportes/lancar
 * Body: { amount: number, billCategoryId: string, description?: string, date?: "YYYY-MM-DD" }
 *
 * Cria um aporte do sócio — bill payable status=pending.
 * billCategoryId precisa ser obrigatoriamente uma subcategoria de
 * "Aporte sócio" (Mercadoria, Embalagem, Frete, Outros…) ou a raiz.
 */
export async function POST(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const body = await req.json().catch(() => null)
    const amount = Number(body?.amount)
    const billCategoryId: string | undefined =
      typeof body?.billCategoryId === "string" ? body.billCategoryId : undefined
    const description: string =
      typeof body?.description === "string" && body.description.trim().length > 0
        ? body.description.trim()
        : "Aporte do sócio"
    const dateStr: string | undefined =
      typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : undefined

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
    }
    if (!billCategoryId) {
      return NextResponse.json({ error: "Categoria obrigatória" }, { status: 400 })
    }

    // Valida que a categoria escolhida é Aporte sócio (raiz ou filha) e
    // não é a sub "Amortização" (que vai sair do modelo).
    const aporteRoot = await prisma.billCategory.findFirst({
      where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
      select: { id: true, children: { select: { id: true, name: true } } },
    })
    if (!aporteRoot) {
      return NextResponse.json(
        { error: "Categoria 'Aporte sócio' não configurada." },
        { status: 412 },
      )
    }
    const validIds = [
      aporteRoot.id,
      ...aporteRoot.children
        .filter((c) => c.name !== "Amortização")
        .map((c) => c.id),
    ]
    if (!validIds.includes(billCategoryId)) {
      return NextResponse.json(
        { error: "Categoria não pertence a 'Aporte sócio'" },
        { status: 400 },
      )
    }

    const date = dateStr ? parseStartOfDayBR(dateStr) : new Date()

    const bill = await prisma.bill.create({
      data: {
        tenantId,
        type: "payable",
        status: "pending",
        category: "outro",
        billCategoryId,
        description,
        amount,
        dueDate: date,
      },
      select: { id: true },
    })

    return NextResponse.json({ ok: true, id: bill.id })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[aportes/lancar]", err)
    return NextResponse.json({ error: "Erro ao registrar aporte" }, { status: 500 })
  }
}
