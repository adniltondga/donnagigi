import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireRole, requireSession } from "@/lib/auth"
import { ensureDefaultCategoriesForTenant } from "@/lib/bill-categories"

export const dynamic = "force-dynamic"

/**
 * GET /api/bill-categories?type=payable|receivable
 * Lista categorias hierárquicas do tenant. Na primeira chamada, cria o
 * conjunto default (idempotente).
 */
export async function GET(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()
    await ensureDefaultCategoriesForTenant(tenantId)

    const typeParam = req.nextUrl.searchParams.get("type")
    const where: { tenantId: string; type?: string } = { tenantId }
    if (typeParam === "payable" || typeParam === "receivable") {
      where.type = typeParam
    }

    const all = await prisma.billCategory.findMany({
      where,
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        _count: { select: { bills: true, children: true } },
      },
    })

    // Monta árvore
    const byId = new Map(
      all.map((c) => ({
        ...c,
        children: [] as typeof all,
      })).map((c) => [c.id, c])
    )
    const roots: Array<(typeof all)[number] & { children: typeof all }> = []
    for (const c of byId.values()) {
      if (c.parentId) {
        const parent = byId.get(c.parentId)
        if (parent) parent.children.push(c)
      } else {
        roots.push(c)
      }
    }
    roots.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ categories: roots })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[bill-categories GET]", err)
    return NextResponse.json({ error: "Erro ao carregar categorias" }, { status: 500 })
  }
}

/**
 * POST /api/bill-categories
 * Body: { name, type: 'payable'|'receivable', parentId?: string }
 * Cria categoria raiz (parentId=null) ou subcategoria.
 */
export async function POST(req: NextRequest) {
  try {
    await requireRole(["OWNER", "ADMIN"])
    const tenantId = await getTenantIdOrDefault()
    const body = await req.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const type = body.type as "payable" | "receivable"
    const parentId = typeof body.parentId === "string" ? body.parentId : null

    if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 })
    if (type !== "payable" && type !== "receivable") {
      return NextResponse.json({ error: "type inválido" }, { status: 400 })
    }

    if (parentId) {
      const parent = await prisma.billCategory.findUnique({
        where: { id: parentId },
        select: { tenantId: true, parentId: true, type: true },
      })
      if (!parent || parent.tenantId !== tenantId) {
        return NextResponse.json({ error: "Categoria pai não encontrada" }, { status: 404 })
      }
      if (parent.parentId) {
        return NextResponse.json({ error: "Não suportamos 3 níveis de hierarquia" }, { status: 400 })
      }
      if (parent.type !== type) {
        return NextResponse.json({ error: "Subcategoria precisa ter o mesmo tipo da categoria pai" }, { status: 400 })
      }
    }

    try {
      const created = await prisma.billCategory.create({
        data: { name, type, tenantId, parentId },
      })
      return NextResponse.json(created, { status: 201 })
    } catch (err: unknown) {
      // Unique constraint (tenantId, parentId, name) — nome duplicado no mesmo nível
      if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "Já existe uma categoria com esse nome aqui" }, { status: 409 })
      }
      throw err
    }
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[bill-categories POST]", err)
    return NextResponse.json({ error: "Erro ao criar categoria" }, { status: 500 })
  }
}
