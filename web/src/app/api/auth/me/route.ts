import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      tenantId: true,
      tenant: { select: { id: true, name: true, slug: true } },
    },
  })

  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
  }

  return NextResponse.json(user)
}

/**
 * Atualiza o perfil do usuário logado:
 *  - name (dele)
 *  - tenantName (nome do negócio / tenant)
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const body = await request.json()
  const name = typeof body.name === "string" ? body.name.trim() : undefined
  const tenantName = typeof body.tenantName === "string" ? body.tenantName.trim() : undefined

  if (name !== undefined && name.length < 2) {
    return NextResponse.json({ error: "Nome muito curto" }, { status: 400 })
  }
  if (tenantName !== undefined && tenantName.length < 2) {
    return NextResponse.json({ error: "Nome do negócio muito curto" }, { status: 400 })
  }

  if (name) {
    await prisma.user.update({ where: { id: session.id }, data: { name } })
  }
  if (tenantName) {
    await prisma.tenant.update({ where: { id: session.tenantId }, data: { name: tenantName } })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      tenantId: true,
      tenant: { select: { id: true, name: true, slug: true } },
    },
  })
  return NextResponse.json(user)
}
