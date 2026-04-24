import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"
import { buildMPAuthUrl, getMPCredentialsForTenant, getMPRedirectUri } from "@/lib/mp"

export const dynamic = "force-dynamic"

/**
 * GET /api/mp/oauth/login
 * Inicia o fluxo OAuth do Mercado Pago redirecionando o usuário
 * pra tela de autorização do MP.
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", req.url))
  }

  const creds = await getMPCredentialsForTenant(session.tenantId)
  if (!creds) {
    const url = new URL("/admin/configuracoes", req.url)
    url.searchParams.set("tab", "ml") // abre a tab de integrações
    url.searchParams.set("mp_error", "Nenhuma credencial MP cadastrada — cadastre antes de conectar.")
    return NextResponse.redirect(url)
  }

  const state = crypto.randomBytes(16).toString("hex")
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min

  await prisma.mPOAuthState.create({
    data: { state, tenantId: session.tenantId, expiresAt },
  })

  const redirectUri = getMPRedirectUri(req, creds)
  const authUrl = buildMPAuthUrl({
    clientId: creds.clientId,
    redirectUri,
    state,
  })

  return NextResponse.redirect(authUrl)
}
