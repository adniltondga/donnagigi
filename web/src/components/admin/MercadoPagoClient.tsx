"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  RefreshCw,
  Wallet,
  Clock,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SummaryCard } from "@/components/ui/summary-card"
import { LoadingState } from "@/components/ui/loading-state"
import { formatCurrency } from "@/lib/calculations"
import { PeriodFilter, PeriodPreset, resolvePreset } from "./PeriodFilter"

interface Payment {
  id: number
  description: string
  netAmount: number
  grossAmount: number
  dateCreated?: string | null
  releaseDate?: string
  statusDetail?: string | null
  paymentMethodId: string | null
  buyer: string | null
  externalReference: string | null
}
interface Day {
  date: string
  total: number
  count: number
  payments: Payment[]
}
interface Snapshot {
  configured: boolean
  unavailableBalance?: number
  pendingCount?: number
  releasedTotal?: number
  releasedCount?: number
  disputedTotal?: number
  disputedCount?: number
  pendingDays?: Day[]
  releasedDays?: Day[]
  disputedPayments?: Payment[]
  cachedSyncedAt?: string | null
  error?: string
}

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  master: "Mastercard",
  visa: "Visa",
  elo: "Elo",
  amex: "Amex",
  hipercard: "Hipercard",
  bolbradesco: "Boleto",
  account_money: "Saldo MP",
}

const STATUS_DETAIL_LABELS: Record<string, string> = {
  in_mediation: "Em mediação",
  pending_waiting_buyer: "Aguardando comprador",
  pending_waiting_review: "Em análise do MP",
}

function formatDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000)
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "long" })
  const full = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  const relative =
    diffDays === 0
      ? "hoje"
      : diffDays === 1
      ? "amanhã"
      : diffDays < 0
      ? `há ${-diffDays}d`
      : `em ${diffDays}d`
  return `${full} · ${weekday} · ${relative}`
}

export function MercadoPagoClient() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [showDisputedList, setShowDisputedList] = useState(false)
  const initialPeriod = resolvePreset("mes")
  const [periodFrom, setPeriodFrom] = useState<string>(initialPeriod.from)
  const [periodTo, setPeriodTo] = useState<string>(initialPeriod.to)
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("mes")
  const [activeTab, setActiveTab] = useState<"programadas" | "liberadas">("programadas")

  // Leitura do cache (instantâneo).
  const loadCache = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/mp/snapshot")
      const data = (await res.json()) as Snapshot
      setSnap(data)
    } catch {
      setSnap({ configured: true, error: "Erro de conexão" })
    } finally {
      setLoading(false)
    }
  }, [])

  // Busca no MP + atualiza o cache (lento — mostra spinner dedicado).
  const refreshFromMP = useCallback(async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch("/api/mp/snapshot", { method: "POST" })
      const data = (await res.json()) as Snapshot
      if (data.error) {
        setSyncError(data.error)
        return
      }
      setSnap(data)
    } catch {
      setSyncError("Erro de conexão ao atualizar")
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    loadCache()
  }, [loadCache])

  const toggleDay = (key: string) => {
    setExpandedDays((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  const notConfigured = snap && !snap.configured

  const cachedAt = snap?.cachedSyncedAt ? new Date(snap.cachedSyncedAt) : null
  const cachedLabel = useMemo(() => {
    if (!cachedAt) return null
    return cachedAt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [cachedAt])

  // Filtra uma lista de dias por período (reutilizável pra pending e released).
  const applyFilter = (source: Day[] | undefined) => {
    if (!source) return [] as Day[]
    return source.filter((day) => day.date >= periodFrom && day.date <= periodTo)
  }

  const filteredDays = useMemo(
    () => applyFilter(snap?.pendingDays),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snap, periodFrom, periodTo]
  )
  const filteredReleased = useMemo(
    () => applyFilter(snap?.releasedDays),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snap, periodFrom, periodTo]
  )

  const disputedPaymentsList = snap?.disputedPayments ?? []

  const filteredPendingTotal = filteredDays.reduce((s, d) => s + d.total, 0)
  const filteredPendingCount = filteredDays.reduce((s, d) => s + d.count, 0)
  const filteredReleasedTotal = filteredReleased.reduce((s, d) => s + d.total, 0)
  const filteredReleasedCount = filteredReleased.reduce((s, d) => s + d.count, 0)

  // Totais do MÊS ATUAL (KPIs fixos, não dependem do filter).
  const sumInCurrentMonth = (days: Day[] | undefined): { total: number; count: number } => {
    if (!days) return { total: 0, count: 0 }
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`
    const last = new Date(y, m + 1, 0)
    const monthEnd = `${y}-${String(m + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`
    let total = 0
    let count = 0
    for (const d of days) {
      if (d.date >= monthStart && d.date <= monthEnd) {
        total += d.total
        count += d.count
      }
    }
    return { total: Math.round(total * 100) / 100, count }
  }
  const releasedMesAtual = useMemo(
    () => sumInCurrentMonth(snap?.releasedDays),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snap?.releasedDays]
  )
  const pendingMesAtual = useMemo(
    () => sumInCurrentMonth(snap?.pendingDays),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snap?.pendingDays]
  )

  // Caso especial: MP não conectado
  if (notConfigured) {
    return (
      <Card className="border-sky-200 bg-sky-50/40">
        <CardContent className="pt-6 pb-6 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-foreground">Mercado Pago não conectado</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Conecte pra ver saldo, retidos e cronograma de liberações.
            </p>
          </div>
          <Link
            href="/admin/configuracoes?tab=ml"
            className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2 rounded-lg text-sm"
          >
            Conectar
          </Link>
        </CardContent>
      </Card>
    )
  }

  const neverSynced = !cachedAt && !loading
  const hasError = snap?.error || syncError

  return (
    <div className="space-y-4">
      {/* Barra superior: atualizar + timestamp */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          {neverSynced ? (
            <span className="text-amber-700">
              Nunca sincronizado — clique em Atualizar pra puxar os dados do MP.
            </span>
          ) : cachedLabel ? (
            <>
              Última atualização: <strong className="text-foreground">{cachedLabel}</strong>
            </>
          ) : (
            "—"
          )}
        </div>
        <Button variant="outline" size="sm" onClick={refreshFromMP} disabled={syncing}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Atualizando..." : "Atualizar"}
        </Button>
      </div>

      {hasError && (
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="pt-4 flex items-start gap-2 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{hasError}</div>
          </CardContent>
        </Card>
      )}

      {/* Grid: Já liberado (mês) · A liberar (mês) · Em mediação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard
            tone="emerald"
            icon={<Clock className="w-5 h-5" />}
            label="Liberado no mês"
            value={releasedMesAtual.total}
            sub={`${releasedMesAtual.count} pagamento${releasedMesAtual.count === 1 ? "" : "s"}`}
            tooltip={`${releasedMesAtual.count} pagamento${releasedMesAtual.count === 1 ? "" : "s"} caíram no MP este mês e já estão disponíveis pra saque.`}
            loading={loading && !snap}
          />
          <SummaryCard
            tone="sky"
            icon={<Clock className="w-5 h-5" />}
            label="A liberar no mês"
            value={pendingMesAtual.total}
            sub={`${pendingMesAtual.count} pagamento${pendingMesAtual.count === 1 ? "" : "s"}`}
            tooltip={`${pendingMesAtual.count} pagamento${pendingMesAtual.count === 1 ? "" : "s"} com liberação prevista até o fim deste mês.`}
            loading={loading && !snap}
          />
          <SummaryCard
            tone={snap?.disputedCount && snap.disputedCount > 0 ? "amber" : "emerald"}
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Em mediação"
            value={snap?.disputedTotal ?? 0}
            sub={
              snap?.disputedCount && snap.disputedCount > 0
                ? `${snap.disputedCount} retido${snap.disputedCount === 1 ? "" : "s"}`
                : "Sem reclamações"
            }
            tooltip={
              snap?.disputedCount && snap.disputedCount > 0
                ? `${snap.disputedCount} pagamento${snap.disputedCount === 1 ? "" : "s"} retido${snap.disputedCount === 1 ? "" : "s"} por reclamação — responda no app do Mercado Pago pra destravar.`
                : "Nenhuma reclamação em aberto no momento."
            }
            loading={loading && !snap}
            action={
              snap?.disputedCount && snap.disputedCount > 0 ? (
                <button
                  onClick={() => setShowDisputedList((v) => !v)}
                  className="text-xs text-amber-800 hover:text-amber-900 font-medium mt-2 flex items-center gap-1"
                >
                  {showDisputedList ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  {showDisputedList ? "Esconder" : "Ver"} pagamentos
                </button>
              ) : null
            }
          />
      </div>

      {/* Lista dos retidos (expand) */}
      {showDisputedList && disputedPaymentsList.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="text-sm text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Pagamentos em mediação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-amber-100">
              {disputedPaymentsList.map((p) => {
                const method = p.paymentMethodId
                  ? METHOD_LABELS[p.paymentMethodId] || p.paymentMethodId
                  : null
                const statusLabel = p.statusDetail
                  ? STATUS_DETAIL_LABELS[p.statusDetail] || p.statusDetail
                  : null
                return (
                  <li key={p.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground line-clamp-1">{p.description}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="font-mono">#{p.id}</span>
                        {p.dateCreated && (
                          <>
                            <span className="text-muted-foreground/60">·</span>
                            <span>
                              aprovado {new Date(p.dateCreated).toLocaleDateString("pt-BR")}
                            </span>
                          </>
                        )}
                        {method && (
                          <>
                            <span className="text-muted-foreground/60">·</span>
                            <span>{method}</span>
                          </>
                        )}
                        {p.buyer && (
                          <>
                            <span className="text-muted-foreground/60">·</span>
                            <span>{p.buyer}</span>
                          </>
                        )}
                        {statusLabel && (
                          <>
                            <span className="text-muted-foreground/60">·</span>
                            <span className="text-amber-700 font-medium">{statusLabel}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-amber-700 tabular-nums whitespace-nowrap">
                      {formatCurrency(p.netAmount)}
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Liberações por dia — abas: Programadas / Já liberado */}
      <Card>
        <CardHeader className="space-y-3">
          {/* Abas */}
          <div className="flex items-center gap-1 border-b border-border -mb-3 -mx-6 px-6">
            <button
              onClick={() => setActiveTab("programadas")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "programadas"
                  ? "border-sky-600 text-sky-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="w-4 h-4" />
              Liberações programadas
              <span className="text-xs text-muted-foreground tabular-nums">
                ({formatCurrency(filteredPendingTotal)})
              </span>
            </button>
            <button
              onClick={() => setActiveTab("liberadas")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "liberadas"
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="w-4 h-4" />
              Já liberado
              <span className="text-xs text-muted-foreground tabular-nums">
                ({formatCurrency(filteredReleasedTotal)})
              </span>
            </button>
          </div>

          {/* Subtítulo */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-3">
            <span className="text-xs text-muted-foreground">
              No período:{" "}
              <strong className="text-foreground">
                {activeTab === "programadas" ? filteredPendingCount : filteredReleasedCount}
              </strong>{" "}
              pagamento
              {(activeTab === "programadas" ? filteredPendingCount : filteredReleasedCount) === 1 ? "" : "s"} ·{" "}
              <strong className="text-emerald-600">
                {formatCurrency(
                  activeTab === "programadas" ? filteredPendingTotal : filteredReleasedTotal
                )}
              </strong>
            </span>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-end gap-3">
            <PeriodFilter
              from={periodFrom}
              to={periodTo}
              preset={periodPreset}
              onChange={(n) => {
                setPeriodFrom(n.from)
                setPeriodTo(n.to)
                setPeriodPreset(n.preset)
              }}
            />

          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !snap ? (
            <LoadingState variant="card" size="sm" className="px-5 py-8" />
          ) : (
            <DayList
              days={activeTab === "programadas" ? filteredDays : filteredReleased}
              emptyLabel={
                activeTab === "programadas"
                  ? neverSynced
                    ? "Clique em Atualizar pra buscar os dados do Mercado Pago."
                    : !snap?.pendingDays || snap.pendingDays.length === 0
                    ? "Nenhum pagamento pendente de liberação."
                    : "Nenhum pagamento casa com esses filtros."
                  : !snap?.releasedDays || snap.releasedDays.length === 0
                  ? "Nenhuma liberação processada nos últimos 180 dias."
                  : "Nenhuma liberação casa com esses filtros."
              }
              iconColor={activeTab === "programadas" ? "text-sky-600" : "text-emerald-600"}
              keyPrefix={activeTab === "programadas" ? "pending" : "released"}
              expandedDays={expandedDays}
              toggleDay={toggleDay}
              subLabel={activeTab === "programadas" ? "pagamento(s)" : "pagamento(s) caíram no MP"}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ============================================================
   Helper component: lista de dias (expansível)
   ============================================================ */

function DayList({
  days,
  emptyLabel,
  iconColor,
  keyPrefix,
  expandedDays,
  toggleDay,
  subLabel,
}: {
  days: Day[]
  emptyLabel: string
  iconColor: string
  keyPrefix: string
  expandedDays: Set<string>
  toggleDay: (key: string) => void
  subLabel: string
}) {
  if (days.length === 0) {
    return <div className="px-5 py-8 text-center text-muted-foreground text-sm">{emptyLabel}</div>
  }
  return (
    <ul className="divide-y divide-gray-100">
      {days.map((day) => {
        const key = `${keyPrefix}-${day.date}`
        const open = expandedDays.has(key)
        return (
          <li key={key}>
            <button
              onClick={() => toggleDay(key)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-accent text-left"
            >
              {open ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <Clock className={`w-4 h-4 ${iconColor} shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{formatDayLabel(day.date)}</div>
                <div className="text-xs text-muted-foreground">
                  {day.count} {subLabel}
                </div>
              </div>
              <div className="text-sm font-bold text-emerald-600 tabular-nums whitespace-nowrap">
                {formatCurrency(day.total)}
              </div>
            </button>
            {open && (
              <ul className="bg-muted divide-y divide-gray-100 border-t border-border">
                {day.payments.map((p) => {
                  const method = p.paymentMethodId
                    ? METHOD_LABELS[p.paymentMethodId] || p.paymentMethodId
                    : null
                  return (
                    <li key={p.id} className="px-12 py-2.5 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground line-clamp-1">{p.description}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                          <span className="font-mono">#{p.id}</span>
                          {p.dateCreated && (
                            <>
                              <span className="text-muted-foreground/60">·</span>
                              <span>
                                comprado {new Date(p.dateCreated).toLocaleDateString("pt-BR")}
                              </span>
                            </>
                          )}
                          {method && (
                            <>
                              <span className="text-muted-foreground/60">·</span>
                              <span>{method}</span>
                            </>
                          )}
                          {p.buyer && (
                            <>
                              <span className="text-muted-foreground/60">·</span>
                              <span>{p.buyer}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="text-sm font-semibold text-emerald-600 tabular-nums">
                          {formatCurrency(p.netAmount)}
                        </div>
                        {p.grossAmount > p.netAmount && (
                          <div className="text-xs text-muted-foreground line-through tabular-nums">
                            {formatCurrency(p.grossAmount)}
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
