import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { generateUniqueTenantSlug } from "@/lib/tenant"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, username, password, name, companyName } = body as {
      email?: string
      username?: string
      password?: string
      name?: string
      companyName?: string
    }

    if (!email || !username || !password || !name) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Senha precisa ter ao menos 6 caracteres" },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Email ou username já cadastrado" },
        { status: 409 }
      )
    }

    const tenantName = (companyName?.trim() || name).slice(0, 100)
    const slug = await generateUniqueTenantSlug(tenantName)
    const hashedPassword = await bcrypt.hash(password, 10)

    // Transação: cria Tenant e User atomicamente — se um falhar, nada fica
    const { user, tenant } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: tenantName, slug },
      })
      const user = await tx.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          name,
          tenantId: tenant.id,
        },
      })
      return { user, tenant }
    })

    return NextResponse.json(
      {
        message: "Conta criada com sucesso",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
        },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json(
      { error: "Erro ao criar conta" },
      { status: 500 }
    )
  }
}
