import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"
import { getMPCredentialsForTenant, getMPRedirectUri } from "@/lib/mp"
import { getMPWebhookUrl } from "@/lib/webhook-url"
import { isWriter } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * GET  — status das credenciais MP do tenant (mascarado)
 * POST — salva/atualiza (OWNER/ADMIN)
 * DELETE — remove (OWNER/ADMIN)
 */

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const creds = await prisma.mPAppCredentials.findUnique({
    where: { tenantId: session.tenantId },
    select: { clientId: true, clientSecret: true, redirectUri: true, updatedAt: true },
  })

  const envId = process.env.MP_CLIENT_ID || null
  const envHasSecret = !!process.env.MP_CLIENT_SECRET
  const effectiveCreds = await getMPCredentialsForTenant(session.tenantId)
  const redirectUri = getMPRedirectUri(request, effectiveCreds)
  const webhookUrl = await getMPWebhookUrl(session.tenantId, request)

  if (creds) {
    return NextResponse.json({
      configured: true,
      source: "tenant",
      clientId: creds.clientId,
      clientSecretMasked:
        creds.clientSecret.length > 8
          ? `${creds.clientSecret.slice(0, 4)}…${creds.clientSecret.slice(-4)}`
          : "••••",
      redirectUri,
      customRedirectUri: creds.redirectUri || null,
      webhookUrl,
      updatedAt: creds.updatedAt,
    })
  }

  return NextResponse.json({
    configured: !!envId && envHasSecret,
    source: envId && envHasSecret ? "env" : null,
    clientId: envId ? `${envId.slice(0, 4)}…${envId.slice(-4)}` : null,
    clientSecretMasked: envHasSecret ? "••••" : null,
    redirectUri,
    webhookUrl,
  })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  if (!isWriter(session.role)) {
    return NextResponse.json({ error: "Sem permissão pra essa ação" }, { status: 403 })
  }

  const { clientId, clientSecret, redirectUri } = (await request.json()) as {
    clientId?: string
    clientSecret?: string
    redirectUri?: string | null
  }

  if (!clientId || clientId.trim().length < 6) {
    return NextResponse.json({ error: "Client ID inválido" }, { status: 400 })
  }

  // Secret em branco no update = mantém o atual (UX: usuário só está mudando clientId/redirectUri)
  const existing = await prisma.mPAppCredentials.findUnique({
    where: { tenantId: session.tenantId },
    select: { clientSecret: true },
  })
  const incomingSecret = clientSecret?.trim() || ""
  const finalSecret = incomingSecret || existing?.clientSecret || ""
  if (!finalSecret || finalSecret.length < 6) {
    return NextResponse.json({ error: "Client Secret é obrigatório" }, { status: 400 })
  }

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

  const saved = await prisma.mPAppCredentials.upsert({
    where: { tenantId: session.tenantId },
    create: {
      tenantId: session.tenantId,
      clientId: clientId.trim(),
      clientSecret: finalSecret,
      redirectUri: normalizedUri,
    },
    update: {
      clientId: clientId.trim(),
      clientSecret: finalSecret,
      redirectUri: normalizedUri,
    },
    select: { updatedAt: true },
  })

  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt })
}

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  if (!isWriter(session.role)) {
    return NextResponse.json({ error: "Sem permissão pra essa ação" }, { status: 403 })
  }

  await prisma.mPAppCredentials.deleteMany({
    where: { tenantId: session.tenantId },
  })

  return NextResponse.json({ ok: true })
}
