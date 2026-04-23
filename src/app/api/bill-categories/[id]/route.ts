import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireRole } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/bill-categories/[id]
 * Body: { name }
 * Só renomeia — mover de pai/tipo não é permitido pra não bagunçar histórico.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["OWNER", "ADMIN"])
    const tenantId = await getTenantIdOrDefault()
    const body = await req.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 })

    const cat = await prisma.billCategory.findUnique({ where: { id: params.id } })
    if (!cat || cat.tenantId !== tenantId) {
      return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 })
    }

    try {
      const updated = await prisma.billCategory.update({
        where: { id: params.id },
        data: { name },
      })
      return NextResponse.json(updated)
    } catch (err: unknown) {
      if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "Já existe uma categoria com esse nome aqui" }, { status: 409 })
      }
      throw err
    }
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[bill-categories PATCH]", err)
    return NextResponse.json({ error: "Erro ao renomear" }, { status: 500 })
  }
}

/**
 * DELETE /api/bill-categories/[id]
 * Bloqueia se a categoria (ou qualquer descendente) tem bill vinculada —
 * pra preservar histórico.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["OWNER", "ADMIN"])
    const tenantId = await getTenantIdOrDefault()

    const cat = await prisma.billCategory.findUnique({
      where: { id: params.id },
      select: { id: true, tenantId: true, _count: { select: { bills: true, children: true } } },
    })
    if (!cat || cat.tenantId !== tenantId) {
      return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 })
    }

    // Bloqueia se ela ou qualquer subcategoria tiver bills
    const subBillsCount = await prisma.bill.count({
      where: { billCategory: { parentId: cat.id }, tenantId },
    })
    const totalBills = cat._count.bills + subBillsCount

    if (totalBills > 0) {
      return NextResponse.json(
        {
          error: `Categoria com ${totalBills} conta(s) vinculada(s) não pode ser removida. Mova as contas pra outra categoria antes.`,
        },
        { status: 400 }
      )
    }

    // Remove em cascata (subcategorias vazias)
    await prisma.billCategory.delete({ where: { id: cat.id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[bill-categories DELETE]", err)
    return NextResponse.json({ error: "Erro ao remover" }, { status: 500 })
  }
}
