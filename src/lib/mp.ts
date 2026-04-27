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

interface MPPaymentRaw {
  id: number
  status?: string
  description?: string | null
  date_created?: string
  date_approved?: string
  money_release_date?: string | null
  transaction_amount?: number
  external_reference?: string | null
  payment_method_id?: string
  /** regular_payment | money_transfer | recurring_payment | pos_payment | ... */
  operation_type?: string
  fee_details?: Array<{ amount?: number }>
  transaction_details?: {
    net_received_amount?: number
  }
  order?: { id?: string | number | null } | null
  additional_info?: {
    items?: Array<{ id?: string; title?: string; quantity?: number }>
  } | null
  payer?: { id?: number | string; email?: string; nickname?: string | null } | null
  /** Aceita tanto collector.id (objeto) quanto collector_id (raiz). */
  collector?: { id?: number | string } | null
  collector_id?: number | string | null
}

interface MPPaymentSearchResult {
  results?: MPPaymentRaw[]
  paging?: { total?: number; limit?: number; offset?: number }
}

/**
 * Filtro defensivo: só payments onde o seller é o COLLECTOR (recebedor).
 * O search do MP retorna payments onde o token também aparece como
 * payer (compras feitas pelo seller via PIX, frete cobrado pelo ML
 * com description "marketplace_shipment", certificado digital MELI,
 * etc). Esses vazariam pra "Liberados/Vendas" se não fossem filtrados.
 *
 * Camadas:
 * 1. operation_type=regular_payment (query) — descarta money_transfer.
 * 2. external_reference começando com "MELI_" — produtos internos do
 *    MELI (ex: certificado digital Soluti).
 * 3. description == "marketplace_shipment" — frete cobrado pelo ML,
 *    é despesa do seller, não venda.
 * 4. collector.id == mpUserId (validação por id quando o MP retorna).
 * 5. payer.id != mpUserId (descarta quando o seller é o pagador).
 */
function isSellerReceiving(p: MPPaymentRaw, collectorId?: string): boolean {
  // Operation type não-venda
  if (p.operation_type && p.operation_type !== "regular_payment") return false

  // Produtos internos do MELI (certificado digital, etc)
  if (p.external_reference?.startsWith("MELI_")) return false

  // Frete cobrado pelo ML — description vem como "marketplace_shipment"
  if (p.description?.toLowerCase().includes("marketplace_shipment")) return false

  // PIX recebido cru: sem external_reference, sem items, sem description.
  // Vendas reais ML sempre têm pelo menos um desses campos preenchido.
  // É transferência avulsa (alguém te mandou PIX direto), não venda.
  const noDescription = !p.description?.trim()
  const noExt = !p.external_reference
  const noItems = !p.additional_info?.items?.length
  if (noDescription && noExt && noItems) return false

  if (!collectorId) return true

  // Valida collector.id (objeto) ou collector_id (raiz) bate com o seller
  const collId = p.collector?.id ?? p.collector_id
  if (collId != null) {
    return String(collId) === String(collectorId)
  }

  // Fallback: se o payer é o próprio seller, é compra dele
  if (p.payer?.id != null && String(p.payer.id) === String(collectorId)) {
    return false
  }

  return true
}

export interface MPPendingPayment {
  id: number
  description: string
  releaseDate: string
  dateCreated: string | null
  netAmount: number
  grossAmount: number
  paymentMethodId: string | null
  externalReference: string | null
  buyer: string | null
}

/**
 * Lista pagamentos aprovados recentes cujo money_release_date ainda é
 * futuro. Base pra "Total a liberar" + lista detalhada por dia.
 *
 * Usa /v1/payments/search (endpoint OAuth-compatível; o antigo
 * /users/{id}/mercadopago_account/balance retorna 403 pra tokens de app).
 * Pagina em batches de 50 até 500 (MP libera em 14-30d).
 */
export async function fetchMPPendingPayments(params: {
  accessToken: string
  /** ID do seller — usado pra filtrar local payments onde ele é collector. */
  collectorId?: string
}): Promise<MPPendingPayment[]> {
  const now = Date.now()
  const out: MPPendingPayment[] = []
  const LIMIT = 50
  let offset = 0
  const MAX_OFFSET = 500

  while (offset < MAX_OFFSET) {
    const q = new URLSearchParams({
      status: "approved",
      sort: "money_release_date",
      criteria: "asc",
      // Filtra direto pelo money_release_date futuro — bate com o cálculo
      // que o app do MP faz no "Total a liberar". Janela de 180 dias
      // cobre cartões parcelados que liberam em 60-90d.
      range: "money_release_date",
      begin_date: "NOW",
      end_date: "NOW+180DAYS",
      // Só vendas reais — exclui PIX que o seller enviou (compras dele).
      operation_type: "regular_payment",
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
      if (!isSellerReceiving(p, params.collectorId)) continue
      // Proteção adicional: se vier algum já liberado (edge da janela), pula.
      const release = new Date(p.money_release_date).getTime()
      if (release <= now) continue

      const net = p.transaction_details?.net_received_amount
      const gross = Number(p.transaction_amount) || 0
      const fees = (p.fee_details || []).reduce(
        (s, f) => s + (Number(f.amount) || 0),
        0
      )
      const netAmount =
        typeof net === "number" && Number.isFinite(net) ? net : gross - fees

      const itemTitle = p.additional_info?.items?.[0]?.title
      const description = (p.description || itemTitle || `Pagamento ${p.id}`).trim()

      out.push({
        id: p.id,
        description,
        releaseDate: p.money_release_date,
        dateCreated: p.date_created || null,
        netAmount: Math.round(netAmount * 100) / 100,
        grossAmount: Math.round(gross * 100) / 100,
        paymentMethodId: p.payment_method_id || null,
        externalReference: p.external_reference || null,
        buyer: p.payer?.nickname || p.payer?.email || null,
      })
    }

    if (batch.length < LIMIT) break
    offset += LIMIT
  }

  return out
}

/**
 * Lista pagamentos aprovados cuja data de liberação JÁ PASSOU (money_release_date
 * no passado). Usado pra mostrar "já liberado" — dinheiro que caiu no MP.
 * Janela: últimos 180 dias.
 */
export async function fetchMPReleasedPayments(params: {
  accessToken: string
  collectorId?: string
}): Promise<MPPendingPayment[]> {
  const now = Date.now()
  const out: MPPendingPayment[] = []
  const LIMIT = 50
  let offset = 0
  const MAX_OFFSET = 500

  while (offset < MAX_OFFSET) {
    const q = new URLSearchParams({
      status: "approved",
      sort: "money_release_date",
      criteria: "desc",
      range: "money_release_date",
      begin_date: "NOW-180DAYS",
      end_date: "NOW",
      operation_type: "regular_payment",
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
      throw new Error(`MP payments/search (released) failed (${res.status}): ${body}`)
    }
    const data: MPPaymentSearchResult = await res.json()
    const batch = data.results || []

    for (const p of batch) {
      if (!p.money_release_date) continue
      if (!isSellerReceiving(p, params.collectorId)) continue
      const release = new Date(p.money_release_date).getTime()
      if (release > now) continue // só os passados

      const net = p.transaction_details?.net_received_amount
      const gross = Number(p.transaction_amount) || 0
      const fees = (p.fee_details || []).reduce(
        (s, f) => s + (Number(f.amount) || 0),
        0
      )
      const netAmount =
        typeof net === "number" && Number.isFinite(net) ? net : gross - fees

      const itemTitle = p.additional_info?.items?.[0]?.title
      const description = (p.description || itemTitle || `Pagamento ${p.id}`).trim()

      out.push({
        id: p.id,
        description,
        releaseDate: p.money_release_date,
        dateCreated: p.date_created || null,
        netAmount: Math.round(netAmount * 100) / 100,
        grossAmount: Math.round(gross * 100) / 100,
        paymentMethodId: p.payment_method_id || null,
        externalReference: p.external_reference || null,
        buyer: p.payer?.nickname || p.payer?.email || null,
      })
    }

    if (batch.length < LIMIT) break
    offset += LIMIT
  }

  return out
}

/**
 * Resumo pro card de topo: soma dos pagamentos a liberar.
 */
export async function fetchMPBalance(params: {
  accessToken: string
}): Promise<MPBalance> {
  const payments = await fetchMPPendingPayments(params)
  const total = payments.reduce((s, p) => s + p.netAmount, 0)
  return {
    unavailableBalance: Math.round(total * 100) / 100,
    pendingReleaseCount: payments.length,
    currencyId: "BRL",
    lastUpdated: new Date().toISOString(),
  }
}

export interface MPDisputedPayment {
  id: number
  description: string
  netAmount: number
  grossAmount: number
  dateCreated: string | null
  statusDetail: string | null
  paymentMethodId: string | null
  buyer: string | null
  externalReference: string | null
}

/**
 * Lista pagamentos em mediação — o MP segura o dinheiro enquanto a
 * reclamação do comprador não é resolvida. Essa é a categoria "Retido
 * por reclamação" que aparece no app do MP.
 *
 * Status: `in_mediation` = disputa aberta (retido). Não incluímos
 * `charged_back` porque aí o dinheiro já saiu (perdeu a disputa).
 */
export async function fetchMPDisputedPayments(params: {
  accessToken: string
  collectorId?: string
}): Promise<MPDisputedPayment[]> {
  const out: MPDisputedPayment[] = []
  const LIMIT = 50
  let offset = 0
  const MAX_OFFSET = 500

  while (offset < MAX_OFFSET) {
    const q = new URLSearchParams({
      status: "in_mediation",
      sort: "date_created",
      criteria: "desc",
      operation_type: "regular_payment",
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
      throw new Error(`MP payments/search (mediation) failed (${res.status}): ${body}`)
    }
    const data: MPPaymentSearchResult & {
      results?: Array<MPPaymentRaw & { status_detail?: string }>
    } = await res.json()
    const batch = data.results || []

    for (const p of batch) {
      if (!isSellerReceiving(p, params.collectorId)) continue
      const net = p.transaction_details?.net_received_amount
      const gross = Number(p.transaction_amount) || 0
      const fees = (p.fee_details || []).reduce(
        (s, f) => s + (Number(f.amount) || 0),
        0
      )
      const netAmount =
        typeof net === "number" && Number.isFinite(net) ? net : gross - fees

      const itemTitle = p.additional_info?.items?.[0]?.title
      const description = (p.description || itemTitle || `Pagamento ${p.id}`).trim()

      out.push({
        id: p.id,
        description,
        netAmount: Math.round(netAmount * 100) / 100,
        grossAmount: Math.round(gross * 100) / 100,
        dateCreated: p.date_created || null,
        statusDetail: (p as MPPaymentRaw & { status_detail?: string }).status_detail || null,
        paymentMethodId: p.payment_method_id || null,
        externalReference: p.external_reference || null,
        buyer: p.payer?.nickname || p.payer?.email || null,
      })
    }

    if (batch.length < LIMIT) break
    offset += LIMIT
  }

  return out
}

/**
 * Busca os 3 datasets MP (balance agregado, dias de liberação, retidos por
 * reclamação) e salva no cache da `MPIntegration`. Chamado quando o user
 * clica "Atualizar" ou via cron/rotina.
 *
 * Agrupa os payments a liberar por dia no fuso America/Sao_Paulo.
 */
export async function syncAndCacheMP(tenantId: string): Promise<{
  cachedSyncedAt: Date
  unavailableBalance: number
  pendingCount: number
  releasedTotal: number
  releasedCount: number
  disputedTotal: number
  disputedCount: number
}> {
  const integration = await prisma.mPIntegration.findUnique({ where: { tenantId } })
  if (!integration) throw new Error("Mercado Pago não conectado nesse tenant")

  // Refresh automático de token, se próximo de expirar
  const fresh = await getMPIntegrationForTenant(tenantId)
  const accessToken = fresh?.accessToken || integration.accessToken

  const collectorId = integration.mpUserId
  const [pending, released, disputed] = await Promise.all([
    fetchMPPendingPayments({ accessToken, collectorId }),
    fetchMPReleasedPayments({ accessToken, collectorId }),
    fetchMPDisputedPayments({ accessToken, collectorId }),
  ])

  // Agrupa payments por dia (America/Sao_Paulo) — reutilizável pra pending/released.
  const groupByDay = (payments: MPPendingPayment[]) => {
    const byDay = new Map<
      string,
      { date: string; total: number; count: number; payments: MPPendingPayment[] }
    >()
    for (const p of payments) {
      const d = new Date(p.releaseDate)
      const dayKey = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
      const slot = byDay.get(dayKey) || { date: dayKey, total: 0, count: 0, payments: [] }
      slot.total += p.netAmount
      slot.count += 1
      slot.payments.push(p)
      byDay.set(dayKey, slot)
    }
    return Array.from(byDay.values())
      .map((d) => ({
        ...d,
        total: Math.round(d.total * 100) / 100,
        payments: d.payments.sort(
          (a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
        ),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  const pendingDays = groupByDay(pending)
  const releasedDays = groupByDay(released)

  const unavailableBalance = Math.round(pending.reduce((s, p) => s + p.netAmount, 0) * 100) / 100
  const releasedTotal = Math.round(released.reduce((s, p) => s + p.netAmount, 0) * 100) / 100
  const disputedTotal = Math.round(disputed.reduce((s, p) => s + p.netAmount, 0) * 100) / 100
  const now = new Date()

  await prisma.mPIntegration.update({
    where: { tenantId },
    data: {
      cachedUnavailableBalance: unavailableBalance,
      cachedPendingCount: pending.length,
      cachedReleasedTotal: releasedTotal,
      cachedReleasedCount: released.length,
      cachedDisputedTotal: disputedTotal,
      cachedDisputedCount: disputed.length,
      cachedPendingDays: pendingDays as unknown as object,
      cachedReleasedDays: releasedDays as unknown as object,
      cachedDisputedPayments: disputed as unknown as object,
      cachedSyncedAt: now,
    },
  })

  return {
    cachedSyncedAt: now,
    unavailableBalance,
    pendingCount: pending.length,
    releasedTotal,
    releasedCount: released.length,
    disputedTotal,
    disputedCount: disputed.length,
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
