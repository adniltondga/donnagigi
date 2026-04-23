import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"
import { getMLRedirectUri } from "@/lib/ml-url"

export const dynamic = "force-dynamic"

/**
 * GET: retorna as credenciais ML do tenant (clientId exposto, secret mascarado)
 * POST: salva/atualiza clientId + clientSecret do tenant
 * DELETE: remove credenciais do tenant (volta pro fallback do .env)
 */

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const creds = await prisma.mLAppCredentials.findUnique({
    where: { tenantId: session.tenantId },
    select: { clientId: true, clientSecret: true, redirectUri: true, updatedAt: true },
  })

  const envId = process.env.ML_CLIENT_ID || null
  const envHasSecret = !!process.env.ML_CLIENT_SECRET
  const redirectUri = await getMLRedirectUri(request, session.tenantId)

  if (creds) {
    return NextResponse.json({
      configured: true,
      source: "tenant",
      clientId: creds.clientId,
      clientSecretMasked: creds.clientSecret.length > 8
        ? `${creds.clientSecret.slice(0, 4)}…${creds.clientSecret.slice(-4)}`
        : "••••",
      redirectUri,
      customRedirectUri: creds.redirectUri || null,
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

  const { clientId, clientSecret, redirectUri } = (await request.json()) as {
    clientId?: string
    clientSecret?: string
    redirectUri?: string | null
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

  // redirectUri é opcional — valida formato se fornecido
  let normalizedUri: string | null = null
  if (redirectUri && redirectUri.trim()) {
    const trimmed = redirectUri.trim()
    if (!/^https?:\/\//i.test(trimmed)) {
      return NextResponse.json(
        { error: "Redirect URI precisa começar com http:// ou https://" },
        { status: 400 }
      )
    }
    normalizedUri = trimmed
  }

  const saved = await prisma.mLAppCredentials.upsert({
    where: { tenantId: session.tenantId },
    create: {
      tenantId: session.tenantId,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      redirectUri: normalizedUri,
    },
    update: {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      redirectUri: normalizedUri,
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
