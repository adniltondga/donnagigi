import type { NextRequest } from "next/server"

/**
 * Retorna a Redirect URI do OAuth ML.
 *
 * Ordem de prioridade:
 *  1) ML_REDIRECT_URI no .env (override explícito — use em prod quando
 *     o domínio público é diferente do que o request recebe via proxy/CDN)
 *  2) Derivado do request (protocol + host atual) — funciona out-of-the-box
 *     em dev (localhost:3000), stage (aglivre.dgadigital.com.br) e prod
 *
 * Isso evita ter que trocar o .env por ambiente — bastam cadastrar no
 * ML DevCenter as URIs de cada ambiente que o app usa.
 */
export function getMLRedirectUri(request: NextRequest | Request): string {
  const envUri = process.env.ML_REDIRECT_URI
  if (envUri && envUri.trim()) return envUri.trim()

  const origin = new URL(request.url).origin
  return `${origin}/api/ml/oauth/callback`
}

/**
 * Versão sem request — pra UI que só tem acesso a window/location no
 * client. Mantém .env como override. Nunca deve ser chamada no server.
 */
export function getMLRedirectUriClient(): string {
  const envUri = process.env.NEXT_PUBLIC_ML_REDIRECT_URI
  if (envUri) return envUri
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/ml/oauth/callback`
  }
  return ""
}
