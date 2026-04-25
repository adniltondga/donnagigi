import { NextResponse } from "next/server"
import { captureError } from "@/lib/sentry"

/**
 * Endpoint de teste do Sentry. Acesse uma vez pra confirmar que erros
 * estão chegando no dashboard. Pode deletar depois de validar.
 *
 * GET /api/sentry-test         → captura um erro proposital
 * GET /api/sentry-test?throw=1 → joga uma exception (testa o handler global)
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const shouldThrow = url.searchParams.get("throw") === "1"

  if (shouldThrow) {
    throw new Error("Sentry test: throw via handler global")
  }

  captureError(new Error("Sentry test: erro capturado manualmente"), {
    tenantId: "test-tenant",
    operation: "sentry-test",
    extra: { now: new Date().toISOString() },
  })

  return NextResponse.json({
    ok: true,
    message: "Erro enviado pro Sentry (se NODE_ENV=production). Cheque o dashboard.",
  })
}
