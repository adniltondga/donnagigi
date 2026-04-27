import prisma from "./prisma"

export type ApiProvider = "ml" | "mp" | "asaas" | "resend"

interface LoggedFetchOpts extends RequestInit {
  /** Provider que está sendo chamado — vira coluna pra agregar. */
  provider: ApiProvider
  /** Tenant que originou a chamada. null/undefined em crons globais. */
  tenantId?: string | null
  /**
   * Endpoint normalizado pra não explodir cardinalidade.
   * Ex: pra `https://api.mercadolibre.com/orders/12345` passe `/orders/{id}`.
   * Default: derivado do path da URL (sem query).
   */
  endpoint?: string
}

/**
 * Wrapper sobre `fetch` que registra cada chamada externa em
 * `ApiCallLog`. Insert é fire-and-forget — falhas no log NUNCA bloqueiam
 * a request real.
 *
 * Body de erro só é guardado pra status >= 400, e truncado em 2KB pra
 * evitar entupir o storage.
 *
 * Uso:
 *   const r = await loggedFetch(url, {
 *     provider: "ml",
 *     tenantId,
 *     endpoint: "/orders/{id}",
 *     headers: { Authorization: `Bearer ${token}` },
 *   })
 */
export async function loggedFetch(
  url: string,
  opts: LoggedFetchOpts
): Promise<Response> {
  const { provider, tenantId, endpoint: providedEndpoint, ...fetchOpts } = opts
  const method = (fetchOpts.method || "GET").toUpperCase()
  const endpoint = providedEndpoint || deriveEndpoint(url)
  const start = Date.now()

  let res: Response
  try {
    res = await fetch(url, fetchOpts)
  } catch (err) {
    // Erro de rede — loga e relança pro caller tratar
    const durationMs = Date.now() - start
    void recordCall({
      tenantId: tenantId ?? null,
      provider,
      endpoint,
      method,
      statusCode: 0, // 0 sinaliza network error
      durationMs,
      errorBody: err instanceof Error ? err.message.slice(0, 2000) : "network error",
    })
    throw err
  }

  const durationMs = Date.now() - start

  // Captura body de erro sem consumir o stream do caller (clone()).
  let errorBody: string | null = null
  if (res.status >= 400) {
    try {
      const cloned = res.clone()
      const text = await cloned.text()
      errorBody = text.slice(0, 2000)
    } catch {
      // ignore
    }
  }

  void recordCall({
    tenantId: tenantId ?? null,
    provider,
    endpoint,
    method,
    statusCode: res.status,
    durationMs,
    errorBody,
  })

  return res
}

interface CallRecord {
  tenantId: string | null
  provider: ApiProvider
  endpoint: string
  method: string
  statusCode: number
  durationMs: number
  errorBody: string | null
}

async function recordCall(rec: CallRecord) {
  try {
    await prisma.apiCallLog.create({ data: rec })
  } catch (e) {
    // Se nem o log entra, manda pro console — não tem fallback melhor
    console.error("[api-log] insert failed:", e)
  }
}

/**
 * Tira o pathname da URL e cuts em `/{n}` quando vê dígitos puros, pra
 * agrupar `/orders/123`, `/orders/456` em `/orders/{id}`. Crude mas
 * cobre 90% dos casos.
 */
function deriveEndpoint(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/\d+/g, "/{id}").replace(/\/MLB\d+/gi, "/{mlb}")
    return path || "/"
  } catch {
    return url.slice(0, 200)
  }
}
