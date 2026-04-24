import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import {
  exchangeMPCodeForToken,
  getMPCredentialsForTenant,
  getMPRedirectUri,
} from "@/lib/mp"

export const dynamic = "force-dynamic"

/**
 * GET /api/mp/oauth/callback?code=...&state=...
 * Recebido pelo Mercado Pago após autorização do usuário.
 */
export async function GET(req: NextRequest) {
  const backTo = (success: boolean, message: string) => {
    const url = new URL("/admin/configuracoes", req.url)
    url.searchParams.set("tab", "ml")
    url.searchParams.set(success ? "mp_success" : "mp_error", message)
    return NextResponse.redirect(url)
  }

  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  const errorParam = req.nextUrl.searchParams.get("error")

  if (errorParam) {
    return backTo(false, `Autorização MP negada: ${errorParam}`)
  }
  if (!code || !state) {
    return backTo(false, "Retorno inválido do MP (faltou code/state).")
  }

  const stateRow = await prisma.mPOAuthState.findUnique({ where: { state } })
  if (!stateRow) {
    return backTo(false, "State expirado ou inválido. Tente conectar de novo.")
  }
  await prisma.mPOAuthState.delete({ where: { state } }).catch(() => {})

  if (stateRow.expiresAt < new Date()) {
    return backTo(false, "State expirado. Conecte de novo.")
  }

  const creds = await getMPCredentialsForTenant(stateRow.tenantId)
  if (!creds) {
    return backTo(false, "Credenciais MP do tenant sumiram durante o fluxo.")
  }

  try {
    const redirectUri = getMPRedirectUri(req, creds)
    const token = await exchangeMPCodeForToken({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      code,
      redirectUri,
    })

    await prisma.mPIntegration.upsert({
      where: { tenantId: stateRow.tenantId },
      create: {
        tenantId: stateRow.tenantId,
        mpUserId: String(token.user_id),
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        scope: token.scope || null,
      },
      update: {
        mpUserId: String(token.user_id),
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        scope: token.scope || null,
      },
    })

    return backTo(true, "Mercado Pago conectado com sucesso!")
  } catch (err) {
    console.error("[mp/callback]", err)
    return backTo(false, err instanceof Error ? err.message : "Erro ao trocar code por token")
  }
}
