"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { Loader2, Package, ChevronDown, ChevronRight } from "lucide-react"
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

// Cores semânticas (3 tons só): vermelho pra urgente, âmbar pra atenção,
// cinza pra resto. Reduz "arco-íris de confusão" da versão anterior.
const STATUS_TONE: Record<Status, string> = {
  ESGOTADO: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
  CRITICO: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
  ATENCAO: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  OK: "bg-muted text-muted-foreground border-border",
  PARADO: "bg-muted text-muted-foreground border-border",
}

type Filter = "URGENT" | "ATENCAO" | "OK" | "PARADO"

const FILTER_OPTIONS: Array<{ key: Filter; label: string }> = [
  { key: "URGENT", label: "Urgentes" },
  { key: "ATENCAO", label: "Atenção" },
  { key: "OK", label: "Tudo OK" },
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

  // KPIs em 3 grupos semânticos (em vez de 5 contadores soltos).
  const kpisAgrupados = useMemo(() => {
    if (!data) return { urgentes: 0, atencao: 0, ok: 0 }
    return {
      urgentes: data.kpis.ESGOTADO + data.kpis.CRITICO,
      atencao: data.kpis.ATENCAO,
      ok: data.kpis.OK + data.kpis.PARADO,
    }
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    if (filter === "URGENT") {
      return data.items.filter((i) => i.worstStatus === "ESGOTADO" || i.worstStatus === "CRITICO")
    }
    if (filter === "OK") {
      return data.items.filter((i) => i.worstStatus === "OK")
    }
    return data.items.filter((i) => i.worstStatus === filter)
  }, [data, filter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recomendações de reposição"
        description="Identifique produtos que precisam ser recomprados antes de esgotar."
        actions={
          <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
            {WINDOW_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setWindowDays(d)}
                className={`px-2.5 py-1 rounded-md transition ${
                  windowDays === d
                    ? "bg-primary-600 text-white"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        }
      />

      {/* KPIs em 3 grupos */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KPIGroup
            label="Urgentes"
            help="Esgotados ou com estoque pra ≤ 7 dias — comprar hoje"
            value={kpisAgrupados.urgentes}
            tone="urgent"
          />
          <KPIGroup
            label="Atenção"
            help="Estoque pra ≤ 14 dias — planejar nos próximos dias"
            value={kpisAgrupados.atencao}
            tone="warn"
          />
          <KPIGroup
            label="Tudo OK"
            help="Estoque suficiente ou produto sem vendas"
            value={kpisAgrupados.ok}
            tone="ok"
          />
        </div>
      )}

      {/* Filtros */}
      <div className="inline-flex flex-wrap rounded-lg border border-border bg-card p-1 text-sm">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md transition ${
              filter === f.key
                ? "bg-primary-600 text-white"
                : "text-muted-foreground hover:bg-accent"
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
      ) : !data ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">
          Erro ao carregar — tente recarregar a página.
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">
          Nada nesse filtro.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-2 py-3 w-8" />
                <th className="text-left px-4 py-3">Produto</th>
                <th className="text-left px-4 py-3">Estoque & vendas</th>
                <th className="text-left px-4 py-3">Sugestão</th>
                <th className="text-left px-4 py-3 w-24">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((it) => {
                const isOpen = expanded.has(it.mlListingId)
                const velocity = it.totalVendas / windowDays
                const daysLeft = velocity > 0 ? Math.floor(it.totalStock / velocity) : null
                const sumSuggested = it.variations.reduce((s, v) => s + v.suggestedQty, 0)
                const sumInvestment = it.variations.reduce(
                  (s, v) => s + (v.productCost != null ? v.productCost * v.suggestedQty : 0),
                  0,
                )
                const hasCostInfo = it.variations.some((v) => v.productCost != null && v.suggestedQty > 0)
                return (
                  <Fragment key={it.mlListingId}>
                    <tr className="hover:bg-accent transition">
                      <td className="px-2 py-3 text-center align-top">
                        {it.hasVariations && (
                          <button
                            type="button"
                            onClick={() => toggle(it.mlListingId)}
                            className="p-1 hover:bg-muted rounded mt-1"
                            aria-label={isOpen ? "Recolher variações" : "Expandir variações"}
                          >
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
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
                            <div className="flex items-center gap-2 mt-0.5">
                              <a
                                href={`https://produto.mercadolivre.com.br/${it.mlListingId.replace("MLB", "MLB-")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-primary-600 hover:underline"
                              >
                                {it.mlListingId}
                              </a>
                              {it.hasVariations && (
                                <span className="bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                                  {it.variations.length} var.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm">
                        <div className="space-y-0.5">
                          <p>
                            <span className="text-muted-foreground">Estoque: </span>
                            <span
                              className={`font-semibold ${it.totalStock === 0 ? "text-red-600" : "text-foreground"}`}
                            >
                              {it.totalStock} un.
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Vende: </span>
                            <span className="text-foreground">
                              {velocity > 0 ? `${velocity.toFixed(2)}/dia` : "—"}
                            </span>
                          </p>
                          {daysLeft != null && (
                            <p>
                              <span className="text-muted-foreground">Acaba em: </span>
                              <span
                                className={`font-semibold ${
                                  daysLeft === 0
                                    ? "text-red-600"
                                    : daysLeft <= 7
                                      ? "text-red-600"
                                      : daysLeft <= 14
                                        ? "text-amber-700"
                                        : "text-foreground"
                                }`}
                              >
                                {daysLeft}d
                              </span>
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm">
                        {sumSuggested > 0 ? (
                          <div className="space-y-0.5">
                            <p>
                              <span className="text-muted-foreground">Comprar: </span>
                              <span className="text-foreground font-semibold">{sumSuggested} un.</span>
                            </p>
                            {hasCostInfo && sumInvestment > 0 ? (
                              <p>
                                <span className="text-muted-foreground">Investimento: </span>
                                <span className="text-foreground font-semibold">
                                  {formatCurrency(sumInvestment)}
                                </span>
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Sem custo cadastrado
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sem ação</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${STATUS_TONE[it.worstStatus]}`}
                        >
                          {STATUS_LABEL[it.worstStatus]}
                        </span>
                      </td>
                    </tr>

                    {/* Variações expandidas — mesmo layout simplificado */}
                    {isOpen && it.hasVariations && (
                      <tr>
                        <td colSpan={5} className="bg-muted/30 px-0 py-0">
                          <div className="px-12 py-3">
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="text-left px-3 py-2">Variação</th>
                                  <th className="text-left px-3 py-2">Estoque & vendas</th>
                                  <th className="text-left px-3 py-2">Sugestão</th>
                                  <th className="text-left px-3 py-2 w-24">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {it.variations
                                  .slice()
                                  .sort((a, b) => {
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
                                        <td className="px-3 py-2 text-foreground align-top">
                                          {v.variationName || (v.variationId ? `Var. ${v.variationId}` : "—")}
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                          <div className="space-y-0.5">
                                            <p>
                                              <span className="text-muted-foreground">Estoque: </span>
                                              <span
                                                className={`font-semibold ${v.stock === 0 ? "text-red-600" : "text-foreground"}`}
                                              >
                                                {v.stock} un.
                                              </span>
                                            </p>
                                            <p>
                                              <span className="text-muted-foreground">Vende: </span>
                                              <span className="text-foreground">
                                                {v.velocityPerDay > 0 ? `${v.velocityPerDay.toFixed(2)}/dia` : "—"}
                                              </span>
                                            </p>
                                            {v.daysOfStock != null && (
                                              <p>
                                                <span className="text-muted-foreground">Acaba em: </span>
                                                <span
                                                  className={`font-semibold ${
                                                    v.daysOfStock === 0
                                                      ? "text-red-600"
                                                      : v.daysOfStock <= 7
                                                        ? "text-red-600"
                                                        : v.daysOfStock <= 14
                                                          ? "text-amber-700"
                                                          : "text-foreground"
                                                  }`}
                                                >
                                                  {Math.floor(v.daysOfStock)}d
                                                </span>
                                              </p>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                          {v.suggestedQty > 0 ? (
                                            <div className="space-y-0.5">
                                              <p>
                                                <span className="text-muted-foreground">Comprar: </span>
                                                <span className="text-foreground font-semibold">
                                                  {v.suggestedQty} un.
                                                </span>
                                              </p>
                                              {totalCost != null ? (
                                                <p>
                                                  <span className="text-muted-foreground">Inv.: </span>
                                                  <span className="text-foreground font-semibold">
                                                    {formatCurrency(totalCost)}
                                                  </span>
                                                </p>
                                              ) : (
                                                <p className="text-muted-foreground">
                                                  Sem custo cadastrado
                                                </p>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground">Sem ação</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 align-top">
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

function KPIGroup({
  label,
  help,
  value,
  tone,
}: {
  label: string
  help: string
  value: number
  tone: "urgent" | "warn" | "ok"
}) {
  const toneClass = {
    urgent: "border-red-200 dark:border-red-800",
    warn: "border-amber-200 dark:border-amber-800",
    ok: "border-border",
  }[tone]
  const valueClass = {
    urgent: "text-red-700 dark:text-red-300",
    warn: "text-amber-700 dark:text-amber-300",
    ok: "text-foreground",
  }[tone]
  return (
    <div className={`rounded-lg border bg-card p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${valueClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{help}</p>
    </div>
  )
}

