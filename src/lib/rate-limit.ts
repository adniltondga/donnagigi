import { NextResponse } from "next/server"

/**
 * Rate limit em memória pra endpoints públicos sensíveis (login, signup,
 * OTP). Suficiente pra single-instance em Coolify; quando escalar pra
 * múltiplas instâncias, trocar o `store` por Redis sem mexer nos call-sites.
 */

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

// Cleanup periódico de buckets expirados pra não vazar memória.
// Não usa setInterval pra evitar segurar processo em testes.
let lastCleanup = 0
function maybeCleanup(now: number) {
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt < now) store.delete(key)
  }
}

export function getClientIp(req: Request): string {
  // Coolify (Traefik) coloca o IP real em x-forwarded-for. Cloudflare em
  // cf-connecting-ip. Fallback pra x-real-ip e por último 'unknown'.
  const cf = req.headers.get("cf-connecting-ip")
  if (cf) return cf
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real
  return "unknown"
}

export interface RateLimitConfig {
  /** Identificador do escopo (ex: "login", "register"). */
  identifier: string
  /** Máximo de requests permitidas na janela. */
  limit: number
  /** Tamanho da janela em milissegundos. */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterSec: number
}

export function checkRateLimit(req: Request, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  maybeCleanup(now)

  const ip = getClientIp(req)
  const key = `${config.identifier}:${ip}`

  let bucket = store.get(key)
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + config.windowMs }
    store.set(key, bucket)
  }

  bucket.count++
  const allowed = bucket.count <= config.limit

  return {
    allowed,
    remaining: Math.max(0, config.limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  }
}

/**
 * Retorna `null` se a request pode prosseguir, ou um NextResponse 429
 * pronto pra `return` quando o limite estoura.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse | null {
  if (result.allowed) return null
  return NextResponse.json(
    {
      error: "Muitas tentativas. Aguarde antes de tentar de novo.",
      retryAfter: result.retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Reset": String(result.resetAt),
      },
    },
  )
}

/** Presets reutilizáveis pra manter consistência entre endpoints. */
export const RATE_LIMITS = {
  login: { identifier: "login", limit: 5, windowMs: 5 * 60_000 },
  register: { identifier: "register", limit: 3, windowMs: 60 * 60_000 },
  forgotPassword: { identifier: "forgot-password", limit: 3, windowMs: 60 * 60_000 },
  verifyEmail: { identifier: "verify-email", limit: 5, windowMs: 5 * 60_000 },
  resetPassword: { identifier: "reset-password", limit: 5, windowMs: 5 * 60_000 },
  resendVerification: { identifier: "resend-verification", limit: 3, windowMs: 60 * 60_000 },
} as const
