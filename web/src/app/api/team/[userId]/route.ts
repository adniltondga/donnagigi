import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireRole, authErrorResponse } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/team/[userId] — muda role de um membro.
 * Body: { role: 'ADMIN' | 'VIEWER' }
 * Só OWNER. Não permite rebaixar OWNER (precisa transferir — fora do escopo).
 */
export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const session = await requireRole(["OWNER"])
    const body = await req.json()
    const role = body.role as "ADMIN" | "VIEWER"
    if (role !== "ADMIN" && role !== "VIEWER") {
      return NextResponse.json({ error: "Papel inválido (use ADMIN ou VIEWER)" }, { status: 400 })
    }

    const target = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, tenantId: true, role: true },
    })
    if (!target || target.tenantId !== session.tenantId) {
      return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 })
    }
    if (target.role === "OWNER") {
      return NextResponse.json(
        { error: "Não é possível mudar o papel do OWNER. Transferência ainda não suportada." },
        { status: 400 }
      )
    }
    if (target.id === session.id) {
      return NextResponse.json({ error: "Você não pode alterar seu próprio papel" }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role },
      select: { id: true, role: true },
    })
    return NextResponse.json(updated)
  } catch (e) {
    return authErrorResponse(e)
  }
}

/**
 * DELETE /api/team/[userId] — remove membro do tenant.
 * OWNER remove qualquer um (menos a si mesmo).
 * ADMIN remove apenas VIEWERs.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const session = await requireRole(["OWNER", "ADMIN"])
    const target = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, tenantId: true, role: true },
    })
    if (!target || target.tenantId !== session.tenantId) {
      return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 })
    }
    if (target.id === session.id) {
      return NextResponse.json({ error: "Você não pode se remover" }, { status: 400 })
    }
    if (target.role === "OWNER") {
      return NextResponse.json({ error: "OWNER não pode ser removido" }, { status: 400 })
    }
    if (session.role === "ADMIN" && target.role !== "VIEWER") {
      return NextResponse.json({ error: "ADMIN só pode remover VIEWER" }, { status: 403 })
    }

    await prisma.user.delete({ where: { id: target.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return authErrorResponse(e)
  }
}
