import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/financeiro/pro-labore/retirar
 * Body: { amount: number, description?: string }
 *
 * Cria um Bill payable status=paid na subcategoria "Pró-labore".
 * Assim o lançamento entra no DRE como despesa do mês — evita inflar
 * o "lucro" no mês seguinte.
 *
 * A subcategoria "Pró-labore" precisa existir com parent name="Pessoal".
 * Se não existir, retorna 412 pedindo configuração.
 */
export async function POST(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const body = await req.json().catch(() => null)
    const amount = Number(body?.amount)
    const description: string =
      typeof body?.description === "string" && body.description.trim().length > 0
        ? body.description.trim()
        : "Retirada de pró-labore"

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Valor inválido" },
        { status: 400 },
      )
    }

    const proLaboreSub = await prisma.billCategory.findFirst({
      where: {
        tenantId,
        type: "payable",
        name: "Pró-labore",
        parent: { name: "Pessoal" },
      },
      select: { id: true },
    })

    if (!proLaboreSub) {
      return NextResponse.json(
        {
          error:
            "Subcategoria 'Pró-labore' não encontrada. Crie em Contas → Categorias (raiz 'Pessoal').",
        },
        { status: 412 },
      )
    }

    const now = new Date()
    const bill = await prisma.bill.create({
      data: {
        tenantId,
        type: "payable",
        status: "paid",
        category: "outro",
        billCategoryId: proLaboreSub.id,
        description,
        amount,
        dueDate: now,
        paidDate: now,
      },
      select: { id: true, amount: true, paidDate: true, description: true },
    })

    return NextResponse.json({ ok: true, bill })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[pro-labore/retirar]", err)
    return NextResponse.json({ error: "Erro ao registrar retirada" }, { status: 500 })
  }
}
