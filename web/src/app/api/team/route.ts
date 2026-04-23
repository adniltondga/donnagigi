import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import prisma from "@/lib/prisma"
import { requireRole, authErrorResponse } from "@/lib/auth"
import { sendEmail, teamInviteTemplate } from "@/lib/email"

export const dynamic = "force-dynamic"

const INVITE_EXPIRY_DAYS = 7

function appBaseUrl(req: NextRequest): string {
  const envUrl = process.env.APP_URL?.replace(/\/$/, "")
  if (envUrl) return envUrl
  // Fallback: reconstrói pela origem do request
  const proto = req.headers.get("x-forwarded-proto") || "http"
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000"
  return `${proto}://${host}`
}

/**
 * GET /api/team
 * Lista membros e convites pendentes do tenant.
 */
export async function GET() {
  try {
    const session = await requireRole(["OWNER", "ADMIN"])
    const [members, pending] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId: session.tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          emailVerified: true,
          createdAt: true,
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      }),
      prisma.invitation.findMany({
        where: { tenantId: session.tenantId, acceptedAt: null, expiresAt: { gt: new Date() } },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ])
    return NextResponse.json({
      members,
      pending,
      currentUserId: session.id,
    })
  } catch (e) {
    return authErrorResponse(e)
  }
}

/**
 * POST /api/team
 * Cria um convite e envia email.
 * Body: { email, role: 'ADMIN' | 'VIEWER' }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["OWNER", "ADMIN"])
    const body = await req.json()
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const role = body.role as "ADMIN" | "VIEWER"

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 })
    }
    if (role !== "ADMIN" && role !== "VIEWER") {
      return NextResponse.json({ error: "Papel inválido (use ADMIN ou VIEWER)" }, { status: 400 })
    }

    // Email já cadastrado em qualquer tenant
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      if (existingUser.tenantId === session.tenantId) {
        return NextResponse.json({ error: "Esse email já faz parte da sua equipe" }, { status: 409 })
      }
      return NextResponse.json({ error: "Esse email já tem conta no agLivre" }, { status: 409 })
    }

    // Convite pendente pro mesmo email no mesmo tenant
    const existingInvite = await prisma.invitation.findFirst({
      where: {
        tenantId: session.tenantId,
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    if (existingInvite) {
      return NextResponse.json({ error: "Já existe um convite pendente pra esse email" }, { status: 409 })
    }

    const token = crypto.randomBytes(24).toString("hex")
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

    const [invitation, inviter, tenant] = await Promise.all([
      prisma.invitation.create({
        data: {
          tenantId: session.tenantId,
          email,
          role,
          token,
          expiresAt,
          createdById: session.id,
        },
      }),
      prisma.user.findUnique({ where: { id: session.id }, select: { name: true } }),
      prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { name: true } }),
    ])

    const acceptUrl = `${appBaseUrl(req)}/convite/${token}`
    try {
      const tpl = teamInviteTemplate({
        inviterName: inviter?.name || "Sua equipe",
        tenantName: tenant?.name || "agLivre",
        role,
        acceptUrl,
      })
      await sendEmail({ to: email, ...tpl })
    } catch (err) {
      console.error("[team/invite] falha ao enviar email:", err)
    }

    return NextResponse.json({ id: invitation.id, email, role, expiresAt }, { status: 201 })
  } catch (e) {
    return authErrorResponse(e)
  }
}
