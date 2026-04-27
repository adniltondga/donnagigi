import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"
import { getMLRedirectUri } from "@/lib/ml-url"
import { getMLWebhookUrl } from "@/lib/webhook-url"
import { isWriter } from "@/lib/auth"

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

  const redirectUri = await getMLRedirectUri(request, session.tenantId)
  const webhookUrl = await getMLWebhookUrl(session.tenantId, request)

  if (creds) {
    return NextResponse.json({
      configured: true,
      clientId: creds.clientId,
      clientSecretMasked: creds.clientSecret.length > 8
        ? `${creds.clientSecret.slice(0, 4)}…${creds.clientSecret.slice(-4)}`
        : "••••",
      redirectUri,
      customRedirectUri: creds.redirectUri || null,
      webhookUrl,
      updatedAt: creds.updatedAt,
    })
  }

  return NextResponse.json({
    configured: false,
    clientId: null,
    clientSecretMasked: null,
    redirectUri,
    webhookUrl,
  })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
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

  // Secret em branco no update = mantém o atual
  const existing = await prisma.mLAppCredentials.findUnique({
    where: { tenantId: session.tenantId },
    select: { clientSecret: true },
  })
  const incomingSecret = clientSecret?.trim() || ""
  const finalSecret = incomingSecret || existing?.clientSecret || ""
  if (!finalSecret || finalSecret.length < 6) {
    return NextResponse.json({ error: "Client Secret é obrigatório" }, { status: 400 })
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
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  if (!isWriter(session.role)) {
    return NextResponse.json({ error: "Sem permissão pra essa ação" }, { status: 403 })
  }

  await prisma.mLAppCredentials.deleteMany({
    where: { tenantId: session.tenantId },
  })

  return NextResponse.json({ ok: true })
}
