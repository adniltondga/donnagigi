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
  if (tenantId) {
    const creds = await prisma.mLAppCredentials.findUnique({
      where: { tenantId },
      select: { redirectUri: true },
    })
    if (creds?.redirectUri && creds.redirectUri.trim()) {
      return creds.redirectUri.trim()
    }
  }

  const origin = new URL(request.url).origin
  return `${origin}/api/ml/oauth/callback`
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
