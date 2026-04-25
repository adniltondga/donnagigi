import type { NextRequest } from "next/server"
import { getMLRedirectUri } from "./ml-url"
import { getMPRedirectUri, getMPCredentialsForTenant } from "./mp"

/**
 * Deriva a URL pública do webhook usando o mesmo source-of-truth do
 * redirect URI OAuth: host do MLAppCredentials/MPAppCredentials.redirectUri
 * → request origin.
 *
 * Reaproveita os helpers getMLRedirectUri / getMPRedirectUri pra manter
 * uma única fonte de verdade: assim a URL do webhook sempre está no mesmo
 * host do callback OAuth.
 */

function extractHost(uri: string): string | null {
  try {
    const u = new URL(uri)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

export async function getMLWebhookUrl(
  tenantId: string | null | undefined,
  request?: NextRequest | Request
): Promise<string> {
  if (request) {
    const redirectUri = await getMLRedirectUri(request, tenantId)
    const host = extractHost(redirectUri)
    if (host) return `${host}/api/ml/webhook`
  }
  return "/api/ml/webhook"
}

export async function getMPWebhookUrl(
  tenantId: string | null | undefined,
  request?: NextRequest
): Promise<string> {
  const creds = tenantId ? await getMPCredentialsForTenant(tenantId) : null
  const redirectUri = getMPRedirectUri(request ?? null, creds)
  const host = extractHost(redirectUri)
  if (host) return `${host}/api/mercadopago/webhook`
  return "/api/mercadopago/webhook"
}
