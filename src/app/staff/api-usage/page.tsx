"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, AlertTriangle, Activity, Zap, AlertCircle } from "lucide-react"
import { feedback } from "@/lib/feedback"

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

interface UsageResponse {
  windowHours: number
  kpis: {
    totalCalls: number
    totalErrors: number
    errorRatePct: number
    avgDurationMs: number
  }
  byProvider: Array<{ provider: string; calls: number }>
  timeline: Array<{ t: string; calls: number }>
  rows: AggRow[]
  recentErrors: RecentError[]
}

const WINDOWS = [
  { h: 1, label: "1h" },
  { h: 6, label: "6h" },
  { h: 24, label: "24h" },
  { h: 72, label: "3d" },
  { h: 168, label: "7d" },
  { h: 720, label: "30d" },
]

const PROVIDERS = ["", "ml", "mp", "asaas", "resend"] as const
const PROVIDER_LABEL: Record<string, string> = {
  "": "Todas",
  ml: "Mercado Livre",
  mp: "Mercado Pago",
  asaas: "ASAAS",
  resend: "Resend",
}

function formatDateTime(s: string): string {
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" })
}

export default function StaffApiUsagePage() {
  const [windowHours, setWindowHours] = useState(24)
  const [provider, setProvider] = useState<string>("")
  const [data, setData] = useState<UsageResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ windowHours: String(windowHours) })
      if (provider) params.set("provider", provider)
      const res = await fetch(`/api/staff/api-usage?${params}`)
      if (!res.ok) {
        feedback.error("Erro ao carregar")
        return
      }
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowHours, provider])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">API Usage</h2>
        <p className="text-sm text-muted-foreground">Monitora chamadas a APIs externas (ML, MP, ASAAS, Resend).</p>
      </div>

      <ExternalTab
        windowHours={windowHours}
        setWindowHours={setWindowHours}
        provider={provider}
        setProvider={setProvider}
        data={data}
        loading={loading}
      />
    </div>
  )
}

function ExternalTab({
  windowHours,
  setWindowHours,
  provider,
  setProvider,
  data,
  loading,
}: {
  windowHours: number
  setWindowHours: (h: number) => void
  provider: string
  setProvider: (p: string) => void
  data: UsageResponse | null
  loading: boolean
}) {
  // Pico do gráfico pra normalizar barras
  const peak = useMemo(() => Math.max(1, ...(data?.timeline || []).map((t) => t.calls)), [data])

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="inline-flex bg-card border border-border rounded-md p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.h}
              onClick={() => setWindowHours(w.h)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                windowHours === w.h ? "bg-primary-600 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="bg-card border border-border rounded-md px-3 py-1.5 text-sm"
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {PROVIDER_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Chamadas" value={data.kpis.totalCalls.toLocaleString("pt-BR")} icon={Activity} accent="primary" />
          <KPI label="Erros" value={data.kpis.totalErrors.toLocaleString("pt-BR")} sub={`${data.kpis.errorRatePct.toFixed(1)}%`} icon={AlertCircle} accent={data.kpis.errorRatePct > 5 ? "rose" : "muted"} />
          <KPI label="Latência média" value={`${data.kpis.avgDurationMs}ms`} icon={Zap} accent="amber" />
          <KPI
            label="Por provider"
            value={
              data.byProvider
                .sort((a, b) => b.calls - a.calls)
                .slice(0, 3)
                .map((p) => `${p.provider} ${p.calls}`)
                .join(" · ") || "—"
            }
            icon={Activity}
            accent="muted"
            valueSize="sm"
          />
        </div>
      )}

      {/* Mini gráfico */}
      {data && data.timeline.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
            Chamadas por hora (últimas {windowHours}h)
          </p>
          <div className="flex items-end gap-0.5 h-20">
            {data.timeline.map((t) => (
              <div
                key={t.t}
                className="flex-1 bg-primary-600 dark:bg-primary-500 rounded-t hover:bg-primary-700 transition relative group"
                style={{ height: `${(t.calls / peak) * 100}%`, minHeight: t.calls > 0 ? "2px" : 0 }}
                title={`${t.t.slice(11, 16)}h: ${t.calls} chamadas`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tabela de endpoints */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold">Endpoints</h3>
        </div>
        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Carregando…
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Nenhuma chamada registrada nesse período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Provider</th>
                  <th className="text-left px-4 py-2">Endpoint</th>
                  <th className="text-left px-4 py-2">Method</th>
                  <th className="text-right px-4 py-2">Chamadas</th>
                  <th className="text-right px-4 py-2">Erros</th>
                  <th className="text-right px-4 py-2">% Erro</th>
                  <th className="text-right px-4 py-2">p50</th>
                  <th className="text-right px-4 py-2">p95</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((r, i) => (
                  <tr key={`${r.provider}-${r.endpoint}-${r.method}-${i}`} className="hover:bg-accent">
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground uppercase">{r.provider}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.endpoint}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.method}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.calls.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.errors > 0 ? <span className="text-rose-600 font-semibold">{r.errors}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className={r.errorRatePct > 5 ? "text-rose-600 font-semibold" : "text-muted-foreground"}>
                        {r.errorRatePct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.p50Ms}ms</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className={r.p95Ms > 3000 ? "text-amber-600 font-semibold" : "text-muted-foreground"}>{r.p95Ms}ms</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Erros recentes */}
      {data && data.recentErrors.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <h3 className="font-semibold">Últimos {data.recentErrors.length} erros</h3>
          </div>
          <ul className="divide-y divide-border">
            {data.recentErrors.map((e) => (
              <li key={e.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs uppercase text-muted-foreground">{e.provider}</span>
                      <span className="font-mono text-xs">{e.method} {e.endpoint}</span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        e.statusCode === 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}>
                        {e.statusCode === 0 ? "NETWORK" : e.statusCode}
                      </span>
                      <span className="text-xs text-muted-foreground">{e.durationMs}ms</span>
                    </div>
                    {e.tenantName && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Tenant: <span className="font-medium text-foreground">{e.tenantName}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(e.createdAt)}</span>
                </div>
                {e.errorBody && (
                  <pre className="mt-2 text-[11px] font-mono bg-muted rounded p-2 text-muted-foreground whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                    {e.errorBody}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function KPI({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  valueSize = "lg",
}: {
  label: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  accent: "primary" | "rose" | "amber" | "muted"
  valueSize?: "sm" | "lg"
}) {
  const tone = {
    primary: "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800",
    rose: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    muted: "bg-card text-foreground border-border",
  }[accent]
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <p className="text-[10px] uppercase tracking-wide font-semibold">{label}</p>
      </div>
      <p className={`font-bold mt-1 ${valueSize === "sm" ? "text-sm" : "text-2xl"}`}>{value}</p>
      {sub && <p className="text-xs opacity-80 mt-0.5">{sub}</p>}
    </div>
  )
}
