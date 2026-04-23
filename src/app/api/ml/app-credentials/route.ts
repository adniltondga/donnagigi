import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * GET: retorna as credenciais ML do tenant (clientId exposto, secret mascarado)
 * POST: salva/atualiza clientId + clientSecret do tenant
 * DELETE: remove credenciais do tenant (volta pro fallback do .env)
 */

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const creds = await prisma.mLAppCredentials.findUnique({
    where: { tenantId: session.tenantId },
    select: { clientId: true, clientSecret: true, updatedAt: true },
  })

  const envId = process.env.ML_CLIENT_ID || null
  const envHasSecret = !!process.env.ML_CLIENT_SECRET
  const redirectUri =
    process.env.ML_REDIRECT_URI ||
    "https://www.aglivre.com.br/api/ml/oauth/callback"

  if (creds) {
    return NextResponse.json({
      configured: true,
      source: "tenant",
      clientId: creds.clientId,
      clientSecretMasked: creds.clientSecret.length > 8
        ? `${creds.clientSecret.slice(0, 4)}…${creds.clientSecret.slice(-4)}`
        : "••••",
      redirectUri,
      updatedAt: creds.updatedAt,
    })
  }

  return NextResponse.json({
    configured: !!envId && envHasSecret,
    source: envId && envHasSecret ? "env" : null,
    clientId: envId ? `${envId.slice(0, 4)}…${envId.slice(-4)}` : null, // mascarado também pro env
    clientSecretMasked: envHasSecret ? "••••" : null,
    redirectUri,
  })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const { clientId, clientSecret } = (await request.json()) as {
    clientId?: string
    clientSecret?: string
  }

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Client ID e Client Secret são obrigatórios" },
      { status: 400 }
    )
  }
  if (clientId.trim().length < 6 || clientSecret.trim().length < 6) {
    return NextResponse.json({ error: "Credenciais muito curtas" }, { status: 400 })
  }

  const saved = await prisma.mLAppCredentials.upsert({
    where: { tenantId: session.tenantId },
    create: {
      tenantId: session.tenantId,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    },
    update: {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    },
    select: { updatedAt: true },
  })

  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt })
}

export async function DELETE() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  await prisma.mLAppCredentials.deleteMany({
    where: { tenantId: session.tenantId },
  })

  return NextResponse.json({ ok: true })
}
