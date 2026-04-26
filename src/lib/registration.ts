/**
 * Cadastro está aberto? Lê (em ordem):
 *  1. `REGISTRATION_OPEN` — server-only, mais limpa, lida em runtime
 *  2. `NEXT_PUBLIC_REGISTRATION_OPEN` — fallback retro-compat (lida em build em client)
 *
 * Default: fechado em produção, aberto em dev/preview.
 * Usar em Server Components/API com `export const dynamic = "force-dynamic"`
 * pra evitar SSG congelando o valor em build-time.
 */
export function isRegistrationOpen(): boolean {
  const flag =
    process.env.REGISTRATION_OPEN ?? process.env.NEXT_PUBLIC_REGISTRATION_OPEN
  if (flag === "true") return true
  if (flag === "false") return false
  // Default: fechado em prod, aberto em dev/preview
  return process.env.NODE_ENV !== "production"
}

/**
 * Fonte do valor — útil pra debug. Mostra qual env mandou e qual o estado.
 */
export function registrationStatus(): {
  open: boolean
  source: "env-REGISTRATION_OPEN" | "env-NEXT_PUBLIC_REGISTRATION_OPEN" | "default-prod" | "default-dev"
  rawValue: string | null
} {
  const a = process.env.REGISTRATION_OPEN
  const b = process.env.NEXT_PUBLIC_REGISTRATION_OPEN
  if (a === "true" || a === "false") {
    return { open: a === "true", source: "env-REGISTRATION_OPEN", rawValue: a }
  }
  if (b === "true" || b === "false") {
    return {
      open: b === "true",
      source: "env-NEXT_PUBLIC_REGISTRATION_OPEN",
      rawValue: b,
    }
  }
  const isProd = process.env.NODE_ENV === "production"
  return {
    open: !isProd,
    source: isProd ? "default-prod" : "default-dev",
    rawValue: null,
  }
}
