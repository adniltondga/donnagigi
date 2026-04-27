"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { Loader2, Package, ChevronDown, ChevronRight, AlertTriangle, Flame, ShoppingCart, CheckCircle2, MoonStar } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { formatCurrency } from "@/lib/calculations"

type Status = "ESGOTADO" | "CRITICO" | "ATENCAO" | "OK" | "PARADO"

interface VariationRec {
  variationId: string | null
  variationName: string | null
  stock: number
  vendas: number
  revenue: number
  velocityPerDay: number
  daysOfStock: number | null
  suggestedQty: number
  status: Status
  productCost: number | null
}
interface ListingRec {
  mlListingId: string
  title: string
  thumbnail: string | null
  hasVariations: boolean
  totalStock: number
  totalVendas: number
  totalRevenue: number
  worstStatus: Status
  variations: VariationRec[]
}
interface Response {
  windowDays: number
  coverageDays: number
  items: ListingRec[]
  kpis: Record<Status, number>
}

const STATUS_LABEL: Record<Status, string> = {
  ESGOTADO: "Esgotado",
  CRITICO: "Crítico",
  ATENCAO: "Atenção",
  OK: "OK",
  PARADO: "Parado",
}

const STATUS_TONE: Record<Status, string> = {
  ESGOTADO: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
  CRITICO: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800",
  ATENCAO: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  OK: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
  PARADO: "bg-muted text-muted-foreground border-border",
}

type Filter = "ALL" | "URGENT" | Status

const FILTER_OPTIONS: Array<{ key: Filter; label: string }> = [
  { key: "ALL", label: "Todos" },
  { key: "URGENT", label: "🔥 Urgentes (esgotado + crítico)" },
  { key: "ESGOTADO", label: "Esgotados" },
  { key: "CRITICO", label: "Críticos (≤ 7 dias)" },
  { key: "ATENCAO", label: "Atenção (≤ 14 dias)" },
  { key: "OK", label: "OK" },
  { key: "PARADO", label: "Parados" },
]

const WINDOW_OPTIONS = [7, 15, 30, 60, 90]

export default function RecomendacoesPage() {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [windowDays, setWindowDays] = useState(30)
  const [filter, setFilter] = useState<Filter>("URGENT")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = async (days: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/produtos/recomendacoes?windowDays=${days}`)
      if (!res.ok) {
        setData(null)
        return
      }
      const json = (await res.json()) as Response
      setData(json)
      // auto-expande tudo que tem urgência
      const next = new Set<string>()
      for (const it of json.items) {
        if (it.worstStatus === "ESGOTADO" || it.worstStatus === "CRITICO") {
          next.add(it.mlListingId)
        }
      }
      setExpanded(next)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(windowDays)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDays])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const filtered = useMemo(() => {
    if (!data) return []
    if (filter === "ALL") return data.items
    if (filter === "URGENT") {
      return data.items.filter((i) => i.worstStatus === "ESGOTADO" || i.worstStatus === "CRITICO")
    }
    return data.items.filter((i) => i.worstStatus === filter)
  }, [data, filter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="🔄 Recomendações de compra"
        description={`Cruza estoque atual no ML com vendas dos últimos ${windowDays} dias e sugere o que comprar pra durar ${data?.coverageDays ?? 30} dias.`}
        actions={
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm"
          >
            {WINDOW_OPTIONS.map((d) => (
              <option key={d} value={d}>
                Janela: últimos {d} dias
              </option>
            ))}
          </select>
        }
      />

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI label="Esgotados" value={data.kpis.ESGOTADO} icon={Flame} accent="rose-strong" />
          <KPI label="Críticos" value={data.kpis.CRITICO} icon={AlertTriangle} accent="rose" />
          <KPI label="Atenção" value={data.kpis.ATENCAO} icon={ShoppingCart} accent="amber" />
          <KPI label="OK" value={data.kpis.OK} icon={CheckCircle2} accent="emerald" />
          <KPI label="Parados" value={data.kpis.PARADO} icon={MoonStar} accent="muted" />
        </div>
      )}

      {/* Filtro de status */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition border ${
              filter === f.key
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-card text-foreground border-border hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-lg p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Calculando recomendações…
        </div>
      ) : !data || filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">
          {data ? "Nada nesse filtro 🎉" : "Erro ao carregar — tente recarregar a página"}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-2 py-3 w-8" />
                <th className="text-left px-4 py-3">Anúncio</th>
                <th className="text-right px-4 py-3">Estoque</th>
                <th className="text-right px-4 py-3">Vendas {windowDays}d</th>
                <th className="text-right px-4 py-3">Velocidade</th>
                <th className="text-right px-4 py-3">Dura</th>
                <th className="text-right px-4 py-3">Sugestão</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((it) => {
                const isOpen = expanded.has(it.mlListingId)
                return (
                  <Fragment key={it.mlListingId}>
                    <tr className="hover:bg-accent transition">
                      <td className="px-2 py-3 text-center">
                        {it.hasVariations && (
                          <button
                            type="button"
                            onClick={() => toggle(it.mlListingId)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {it.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.thumbnail}
                              alt=""
                              loading="lazy"
                              className="w-12 h-12 rounded-lg object-cover border border-border bg-muted shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg border border-border bg-muted flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-muted-foreground/60" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-foreground font-medium truncate">{it.title || "—"}</div>
                            <a
                              href={`https://produto.mercadolivre.com.br/${it.mlListingId.replace("MLB", "MLB-")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-mono text-primary-600 hover:underline"
                            >
                              {it.mlListingId}
                            </a>
                            {it.hasVariations && (
                              <span className="ml-2 bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                                {it.variations.length} var.
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        <span className={it.totalStock === 0 ? "text-rose-600 font-semibold" : ""}>
                          {it.totalStock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{it.totalVendas}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                        {(it.totalVendas / windowDays).toFixed(2)}/dia
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(() => {
                          const v = it.totalVendas / windowDays
                          if (v <= 0) return <span className="text-muted-foreground">—</span>
                          const days = Math.floor(it.totalStock / v)
                          return (
                            <span
                              className={
                                days === 0
                                  ? "text-rose-600 font-bold"
                                  : days <= 7
                                  ? "text-rose-600 font-semibold"
                                  : days <= 14
                                  ? "text-amber-600 font-semibold"
                                  : "text-foreground"
                              }
                            >
                              {days}d
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(() => {
                          const sum = it.variations.reduce((s, v) => s + v.suggestedQty, 0)
                          if (sum <= 0) return <span className="text-muted-foreground">—</span>
                          return <span className="text-foreground font-semibold">{sum} un.</span>
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${STATUS_TONE[it.worstStatus]}`}
                        >
                          {STATUS_LABEL[it.worstStatus]}
                        </span>
                      </td>
                    </tr>

                    {/* Variações expandidas */}
                    {isOpen && it.hasVariations && (
                      <tr>
                        <td colSpan={8} className="bg-muted/30 px-0 py-0">
                          <div className="px-12 py-2">
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="text-left px-3 py-2">Variação</th>
                                  <th className="text-right px-3 py-2">Estoque</th>
                                  <th className="text-right px-3 py-2">Vendas</th>
                                  <th className="text-right px-3 py-2">Velocidade</th>
                                  <th className="text-right px-3 py-2">Dura</th>
                                  <th className="text-right px-3 py-2">Sugestão</th>
                                  <th className="text-right px-3 py-2">Custo total</th>
                                  <th className="text-left px-3 py-2">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {it.variations
                                  .slice()
                                  .sort((a, b) => {
                                    // mesma ordenação por urgência dentro do anúncio
                                    const rank: Record<Status, number> = {
                                      ESGOTADO: 0,
                                      CRITICO: 1,
                                      ATENCAO: 2,
                                      OK: 3,
                                      PARADO: 4,
                                    }
                                    return rank[a.status] - rank[b.status]
                                  })
                                  .map((v) => {
                                    const totalCost =
                                      v.productCost != null && v.suggestedQty > 0
                                        ? v.productCost * v.suggestedQty
                                        : null
                                    return (
                                      <tr key={v.variationId ?? "_no_var"} className="border-t border-border">
                                        <td className="px-3 py-2 text-foreground">
                                          {v.variationName || (v.variationId ? `Var. ${v.variationId}` : "—")}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          <span className={v.stock === 0 ? "text-rose-600 font-semibold" : "text-foreground"}>
                                            {v.stock}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-foreground">{v.vendas}</td>
                                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                          {v.velocityPerDay.toFixed(2)}/dia
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {v.daysOfStock == null ? (
                                            <span className="text-muted-foreground">—</span>
                                          ) : (
                                            <span
                                              className={
                                                v.daysOfStock === 0
                                                  ? "text-rose-600 font-bold"
                                                  : v.daysOfStock <= 7
                                                  ? "text-rose-600"
                                                  : v.daysOfStock <= 14
                                                  ? "text-amber-600"
                                                  : "text-foreground"
                                              }
                                            >
                                              {Math.floor(v.daysOfStock)}d
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                          {v.suggestedQty > 0 ? (
                                            <span className="text-foreground font-semibold">{v.suggestedQty} un.</span>
                                          ) : (
                                            <span className="text-muted-foreground">—</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                          {totalCost != null ? formatCurrency(totalCost) : "—"}
                                        </td>
                                        <td className="px-3 py-2">
                                          <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${STATUS_TONE[v.status]}`}
                                          >
                                            {STATUS_LABEL[v.status]}
                                          </span>
                                        </td>
                                      </tr>
                                    )
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface KPIIconProps {
  className?: string
}
function KPI({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number
  icon: React.ComponentType<KPIIconProps>
  accent: "rose-strong" | "rose" | "amber" | "emerald" | "muted"
}) {
  const tone = {
    "rose-strong": "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
    rose: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    emerald:
      "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    muted: "bg-muted text-muted-foreground border-border",
  }[accent]
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <p className="text-[10px] uppercase tracking-wide font-semibold">{label}</p>
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}
