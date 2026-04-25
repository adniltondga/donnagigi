import * as Sentry from "@sentry/nextjs"

/**
 * Captura um erro no Sentry com contexto do tenant.
 *
 * Use em vez de `console.error` em pontos críticos onde saber QUAL cliente
 * foi afetado importa: handlers ML/MP, sync de pedidos, jobs em background.
 *
 * Em dev, ainda imprime no console (útil pra debug local).
 */
export function captureError(
  err: unknown,
  context: {
    tenantId?: string
    operation?: string // ex: "ml-order-sync", "release-and-refunds"
    extra?: Record<string, unknown>
  } = {},
) {
  // Sempre imprime no console — fica visível no log do servidor.
  console.error(`[${context.operation || "error"}]`, err, context.extra || "")

  Sentry.withScope((scope) => {
    if (context.tenantId) scope.setTag("tenantId", context.tenantId)
    if (context.operation) scope.setTag("operation", context.operation)
    if (context.extra) scope.setContext("extra", context.extra)
    Sentry.captureException(err)
  })
}
