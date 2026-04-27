import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { AuthError, authErrorResponse, requireStaff } from "@/lib/auth"

export const dynamic = "force-dynamic"

interface AggRow {
  provider: string
  endpoint: string
  method: string
  calls: number
  errors: number
  errorRatePct: number
  p50Ms: number
  p95Ms: number
}

interface RecentError {
  id: string
  provider: string
  endpoint: string
  method: string
  statusCode: number
  durationMs: number
  errorBody: string | null
  tenantId: string | null
  tenantName: string | null
  createdAt: string
}

/**
 * GET /api/staff/api-usage?windowHours=24[&provider=ml]
 *
 * Agrega ApiCallLog na janela informada (default 24h):
 *  - KPIs: chamadas totais, taxa de erro, latência média
 *  - Top endpoints por volume com p50/p95
 *  - Calls/hora pra gráfico
 *  - Últimos 50 erros pra debug
 */
export async function GET(req: NextRequest) {
  try {
    await requireStaff()
    const sp = req.nextUrl.searchParams
    const windowHours = Math.max(1, Math.min(720, Number(sp.get("windowHours")) || 24))
    const provider = sp.get("provider") || undefined
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000)

    const where = {
      createdAt: { gte: since },
      ...(provider ? { provider } : {}),
    }

    // Pega tudo da janela — quantidade limitada pelo retention 30d.
    const logs = await prisma.apiCallLog.findMany({
      where,
      select: {
        id: true,
        provider: true,
        endpoint: true,
        method: true,
        statusCode: true,
        durationMs: true,
        errorBody: true,
        tenantId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    // Agrega por (provider, endpoint, method)
    const groupMap = new Map<string, { calls: number; errors: number; durations: number[] }>()
    for (const l of logs) {
      const key = `${l.provider}|${l.endpoint}|${l.method}`
      const g = groupMap.get(key) || { calls: 0, errors: 0, durations: [] }
      g.calls++
      if (l.statusCode === 0 || l.statusCode >= 400) g.errors++
      g.durations.push(l.durationMs)
      groupMap.set(key, g)
    }

    const rows: AggRow[] = Array.from(groupMap.entries())
      .map(([key, g]) => {
        const [provider, endpoint, method] = key.split("|")
        const sorted = g.durations.slice().sort((a, b) => a - b)
        const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0
        const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
        return {
          provider,
          endpoint,
          method,
          calls: g.calls,
          errors: g.errors,
          errorRatePct: g.calls > 0 ? (g.errors / g.calls) * 100 : 0,
          p50Ms: p50,
          p95Ms: p95,
        }
      })
      .sort((a, b) => b.calls - a.calls)

    // KPIs gerais
    const totalCalls = logs.length
    const totalErrors = logs.filter((l) => l.statusCode === 0 || l.statusCode >= 400).length
    const avgDurationMs =
      totalCalls > 0 ? Math.round(logs.reduce((s, l) => s + l.durationMs, 0) / totalCalls) : 0
    const errorRatePct = totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0
    const byProviderMap = new Map<string, number>()
    for (const l of logs) byProviderMap.set(l.provider, (byProviderMap.get(l.provider) || 0) + 1)
    const byProvider = Array.from(byProviderMap.entries()).map(([provider, calls]) => ({
      provider,
      calls,
    }))

    // Hora a hora pra gráfico simples
    const buckets = new Map<string, number>()
    const now = Date.now()
    for (let i = windowHours - 1; i >= 0; i--) {
      const t = new Date(now - i * 60 * 60 * 1000)
      const k = `${t.toISOString().slice(0, 13)}:00`
      buckets.set(k, 0)
    }
    for (const l of logs) {
      const k = `${l.createdAt.toISOString().slice(0, 13)}:00`
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) || 0) + 1)
    }
    const timeline = Array.from(buckets.entries()).map(([t, calls]) => ({ t, calls }))

    // Erros recentes — junta nome do tenant pra contextualizar
    const errorLogs = logs.filter((l) => l.statusCode === 0 || l.statusCode >= 400).slice(0, 50)
    const tenantIds = Array.from(new Set(errorLogs.map((l) => l.tenantId).filter((x): x is string => !!x)))
    const tenants = tenantIds.length
      ? await prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        })
      : []
    const tenantNameById = new Map(tenants.map((t) => [t.id, t.name]))
    const recentErrors: RecentError[] = errorLogs.map((l) => ({
      id: l.id,
      provider: l.provider,
      endpoint: l.endpoint,
      method: l.method,
      statusCode: l.statusCode,
      durationMs: l.durationMs,
      errorBody: l.errorBody,
      tenantId: l.tenantId,
      tenantName: l.tenantId ? tenantNameById.get(l.tenantId) ?? null : null,
      createdAt: l.createdAt.toISOString(),
    }))

    return NextResponse.json({
      windowHours,
      kpis: {
        totalCalls,
        totalErrors,
        errorRatePct,
        avgDurationMs,
      },
      byProvider,
      timeline,
      rows,
      recentErrors,
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[staff/api-usage GET]", err)
    return NextResponse.json({ error: "Erro" }, { status: 500 })
  }
}
