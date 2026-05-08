import type { NextRequest } from "next/server"
import prisma from "./prisma"

/**
 * Retorna a Redirect URI do OAuth ML.
 *
 * Ordem de prioridade:
 *  1) MLAppCredentials.redirectUri do tenant (configurável por cliente)
 *  2) Derivado do request (protocol + host atual)
 */
export async function getMLRedirectUri(
  request: NextRequest | Request,
  tenantId?: string | null
): Promise<string> {
  // 1. URL canônica do SaaS (env var) — fonte da verdade pra prod multi-tenant.
  //    Setar no Vercel: NEXT_PUBLIC_APP_URL=https://aglivre.dgadigital.com.br
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").trim()
  if (appUrl) {
    return ensureCallbackPath(appUrl, "/api/ml/oauth/callback")
  }

  // 2. Custom por tenant (legado — mantém compat se já houver alguém usando).
  if (tenantId) {
    const creds = await prisma.mLAppCredentials.findUnique({
      where: { tenantId },
      select: { redirectUri: true },
    })
    if (creds?.redirectUri && creds.redirectUri.trim()) {
      return ensureCallbackPath(creds.redirectUri.trim(), "/api/ml/oauth/callback")
    }
  }

  // 3. Fallback: derivado do request (dev local sem env).
  const origin = new URL(request.url).origin
  return `${origin}/api/ml/oauth/callback`
}

/**
 * Aceita uma URL canônica que pode ser só o host (ex: https://app.com)
 * OU a URL completa do callback. Retorna sempre a URL completa.
 *
 * - "https://app.com"                          → "https://app.com{defaultPath}"
 * - "https://app.com/"                          → "https://app.com{defaultPath}"
 * - "https://app.com/api/ml/oauth/callback"    → mantém como está
 */
function ensureCallbackPath(uri: string, defaultPath: string): string {
  try {
    const u = new URL(uri)
    if (!u.pathname || u.pathname === "/" || u.pathname === "") {
      return `${u.protocol}//${u.host}${defaultPath}`
    }
    return uri
  } catch {
    return uri
  }
}

/**
 * Versão sem request — pra UI que só tem acesso a window/location no
 * client. Nunca deve ser chamada no server.
 */
export function getMLRedirectUriClient(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/ml/oauth/callback`
  }
  return ""
}
