import crypto from "node:crypto"
import prisma from "./prisma"
import type { NextRequest } from "next/server"

/**
 * Helpers para o Mercado Pago — credenciais por tenant + OAuth token
 * management. Mesmo padrão do src/lib/ml.ts.
 *
 * Endpoints do MP:
 *  - Autorização: https://auth.mercadopago.com.br/authorization
 *  - Token exchange / refresh: https://api.mercadopago.com/oauth/token
 *  - API base: https://api.mercadopago.com
 */

const MP_AUTH_URL = "https://auth.mercadopago.com.br/authorization"
const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token"

export interface MPCreds {
  clientId: string
  clientSecret: string
  redirectUri?: string | null
  source: "tenant" | "env"
}

/**
 * Credenciais do app MP pra esse tenant.
 * Prioridade: MPAppCredentials no banco > MP_CLIENT_ID/MP_CLIENT_SECRET no env.
 */
export async function getMPCredentialsForTenant(tenantId: string): Promise<MPCreds | null> {
  const creds = await prisma.mPAppCredentials.findUnique({ where: { tenantId } })
  if (creds) {
    return {
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      redirectUri: creds.redirectUri,
      source: "tenant",
    }
  }
  const envId = process.env.MP_CLIENT_ID
  const envSecret = process.env.MP_CLIENT_SECRET
  if (envId && envSecret) {
    return { clientId: envId, clientSecret: envSecret, redirectUri: null, source: "env" }
  }
  return null
}

/**
 * Resolve a redirect URI efetiva: prefere a salva no tenant, senão env,
 * senão deriva do request (`<protocol>://<host>/api/mp/oauth/callback`).
 */
export function getMPRedirectUri(
  req: NextRequest | null,
  creds: MPCreds | null
): string {
  if (creds?.redirectUri) return creds.redirectUri
  if (process.env.MP_REDIRECT_URI) return process.env.MP_REDIRECT_URI
  if (req) {
    const proto = req.headers.get("x-forwarded-proto") || "http"
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000"
    return `${proto}://${host}/api/mp/oauth/callback`
  }
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")
  return `${base}/api/mp/oauth/callback`
}

/**
 * Monta a URL de autorização OAuth do MP pro tenant logado.
 * MP exige PKCE S256: passamos code_challenge aqui e code_verifier no exchange.
 */
export function buildMPAuthUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}): string {
  const url = new URL(MP_AUTH_URL)
  url.searchParams.set("client_id", params.clientId)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("platform_id", "mp")
  url.searchParams.set("state", params.state)
  url.searchParams.set("redirect_uri", params.redirectUri)
  url.searchParams.set("code_challenge", params.codeChallenge)
  url.searchParams.set("code_challenge_method", "S256")
  return url.toString()
}

/**
 * Gera um par (code_verifier, code_challenge) pra PKCE S256.
 * verifier: 43-128 chars base64url; challenge = BASE64URL(SHA256(verifier)).
 */
export function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString("base64url")
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url")
  return { verifier, challenge }
}

interface MPTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope?: string
  user_id: number
  refresh_token?: string
  public_key?: string
  live_mode?: boolean
}

/**
 * Troca o `code` do OAuth por access_token. Usado no callback.
 * `codeVerifier` é o verifier gerado no /login (PKCE S256).
 */
export async function exchangeMPCodeForToken(params: {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
  codeVerifier: string
}): Promise<MPTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  })
  const res = await fetch(MP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`MP token exchange failed (${res.status}): ${err}`)
  }
  return res.json()
}

/**
 * Usa refresh_token pra conseguir um novo access_token.
 */
export async function refreshMPToken(params: {
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<MPTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
  })
  const res = await fetch(MP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`MP token refresh failed (${res.status}): ${err}`)
  }
  return res.json()
}

/**
 * Retorna a integração ativa do tenant com access_token válido. Se o
 * token estiver perto de expirar (< 5 min) e tiver refresh_token, renova
 * automaticamente.
 */
export interface MPBalance {
  /** Pagamentos aprovados cujo money_release_date ainda não chegou = "Total a liberar". */
  unavailableBalance: number
  /** Número de pagamentos contados em `unavailableBalance`. */
  pendingReleaseCount: number
  currencyId: string
  lastUpdated: string
}

interface MPPaymentSearchResult {
  results?: Array<{
    id: number
    status?: string
    transaction_amount?: number
    money_release_date?: string | null
    fee_details?: Array<{ amount?: number }>
    transaction_details?: {
      net_received_amount?: number
    }
  }>
  paging?: { total?: number; limit?: number; offset?: number }
}

/**
 * Calcula o "Total a liberar" do vendedor MP somando os pagamentos
 * aprovados cujo `money_release_date` é no futuro.
 *
 * Usa `/v1/payments/search` — endpoint público OAuth-compatível (o antigo
 * `/users/{id}/mercadopago_account/balance` retorna 403 pra tokens de app).
 *
 * Pagina em batches de 50 e limita a 500 pra não travar (> que isso é
 * cenário atípico — MP libera em 14-30 dias, dificilmente alguém tem mil
 * pagamentos presos).
 */
export async function fetchMPBalance(params: {
  accessToken: string
}): Promise<MPBalance> {
  const now = Date.now()
  let unavailable = 0
  let pendingCount = 0
  const LIMIT = 50
  let offset = 0
  const MAX_OFFSET = 500

  while (offset < MAX_OFFSET) {
    const q = new URLSearchParams({
      status: "approved",
      sort: "date_created",
      criteria: "desc",
      range: "date_created",
      // MP aceita "NOW-60DAYS" como atalho. Pega pagamentos recentes que
      // ainda podem ter saldo a liberar.
      begin_date: "NOW-60DAYS",
      end_date: "NOW",
      limit: String(LIMIT),
      offset: String(offset),
    })
    const url = `https://api.mercadopago.com/v1/payments/search?${q.toString()}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`MP payments/search failed (${res.status}): ${body}`)
    }
    const data: MPPaymentSearchResult = await res.json()
    const batch = data.results || []

    for (const p of batch) {
      if (!p.money_release_date) continue
      const release = new Date(p.money_release_date).getTime()
      if (release <= now) continue
      // Preferimos net_received_amount; se não vier, cai pra transaction - fees
      const net = p.transaction_details?.net_received_amount
      if (typeof net === "number" && Number.isFinite(net)) {
        unavailable += net
      } else {
        const gross = Number(p.transaction_amount) || 0
        const fees = (p.fee_details || []).reduce(
          (s, f) => s + (Number(f.amount) || 0),
          0
        )
        unavailable += gross - fees
      }
      pendingCount += 1
    }

    if (batch.length < LIMIT) break
    offset += LIMIT
  }

  return {
    unavailableBalance: Math.round(unavailable * 100) / 100,
    pendingReleaseCount: pendingCount,
    currencyId: "BRL",
    lastUpdated: new Date().toISOString(),
  }
}

export async function getMPIntegrationForTenant(tenantId: string) {
  const integration = await prisma.mPIntegration.findUnique({ where: { tenantId } })
  if (!integration) return null

  const fiveMin = 5 * 60 * 1000
  if (integration.expiresAt.getTime() - Date.now() > fiveMin) {
    return integration
  }

  if (!integration.refreshToken) return integration // expirado sem refresh — UI vai pedir reconexão

  const creds = await getMPCredentialsForTenant(tenantId)
  if (!creds) return integration

  try {
    const fresh = await refreshMPToken({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      refreshToken: integration.refreshToken,
    })
    const updated = await prisma.mPIntegration.update({
      where: { tenantId },
      data: {
        accessToken: fresh.access_token,
        refreshToken: fresh.refresh_token || integration.refreshToken,
        expiresAt: new Date(Date.now() + fresh.expires_in * 1000),
        scope: fresh.scope || integration.scope,
      },
    })
    return updated
  } catch (err) {
    console.error("[mp] falha no refresh:", err)
    return integration
  }
}
