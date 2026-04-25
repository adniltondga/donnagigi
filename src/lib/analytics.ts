/**
 * Helper de eventos custom do Plausible. Tipado pra evitar typo
 * em nomes de evento.
 *
 * Uso:
 *   import { trackEvent } from "@/lib/analytics"
 *   trackEvent("signup_completed", { plan: "PRO" })
 *
 * Em SSR ou quando Plausible não está carregado, vira no-op silencioso.
 */

export type AnalyticsEvent =
  | "signup_completed"
  | "ml_connected"
  | "mp_connected"
  | "subscription_upgraded"

declare global {
  interface Window {
    plausible?: (
      name: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void
  }
}

export function trackEvent(
  name: AnalyticsEvent,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return
  if (typeof window.plausible !== "function") return
  try {
    window.plausible(name, props ? { props } : undefined)
  } catch {
    // Falha silenciosa — analytics nunca deve quebrar UX.
  }
}
