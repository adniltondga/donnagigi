import type { NextRequest } from "next/server"
import prisma from "./prisma"

/**
 * Deriva a URL pública do webhook a partir do mesmo source-of-truth usado
 * pelo OAuth redirectUri: se o tenant tem um app cadastrado com redirectUri
 * próprio, usa o host DE LÁ. Isso garante que a URL do webhook sempre
 * bate com o domínio onde o tenant de fato roda o SaaS (white-label,
 * subdomínio, domínio próprio etc).
 *
 * Ordem de prioridade:
 *  1) host do MLAppCredentials.redirectUri (ou MPAppCredentials) do tenant
 *  2) NEXT_PUBLIC_APP_URL do .env
 *  3) origin do request (quando disponível)
 *  4) fallback vazio
 */

type Platform = "ml" | "mp"

async function getTenantRedirectHost(
  platform: Platform,
  tenantId: string | null | undefined
): Promise<string | null> {
  if (!tenantId) return null
  const creds =
    platform === "ml"
      ? await prisma.mLAppCredentials.findUnique({
          where: { tenantId },
          select: { redirectUri: true },
        })
      : await prisma.mPAppCredentials.findUnique({
          where: { tenantId },
          select: { redirectUri: true },
        })
  if (!creds?.redirectUri?.trim()) return null
  try {
    const u = new URL(creds.redirectUri.trim())
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

function getEnvHost(): string | null {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL
  if (!envUrl?.trim()) return null
  try {
    const u = new URL(envUrl.trim())
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

function getRequestHost(request?: NextRequest | Request): string | null {
  if (!request) return null
  try {
    const u = new URL(request.url)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

export async function getMLWebhookUrl(
  tenantId: string | null | undefined,
  request?: NextRequest | Request
): Promise<string> {
  const host =
    (await getTenantRedirectHost("ml", tenantId)) ||
    getEnvHost() ||
    getRequestHost(request) ||
    ""
  return host ? `${host}/api/ml/webhook` : "/api/ml/webhook"
}

export async function getMPWebhookUrl(
  tenantId: string | null | undefined,
  request?: NextRequest | Request
): Promise<string> {
  const host =
    (await getTenantRedirectHost("mp", tenantId)) ||
    getEnvHost() ||
    getRequestHost(request) ||
    ""
  return host ? `${host}/api/mercadopago/webhook` : "/api/mercadopago/webhook"
}
