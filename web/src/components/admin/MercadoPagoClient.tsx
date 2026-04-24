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
  Loader,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/calculations"

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
  disputedTotal?: number
  disputedCount?: number
  pendingDays?: Day[]
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
  const [periodFilter, setPeriodFilter] = useState<"7" | "15" | "30" | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

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

  // Aplica filtros de período (dias a partir de hoje) e busca por texto.
  const filteredDays = useMemo(() => {
    if (!snap?.pendingDays) return [] as Day[]
    const q = searchQuery.trim().toLowerCase()
    const maxDays = periodFilter === "all" ? null : Number(periodFilter)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cutoff = maxDays
      ? new Date(today.getTime() + maxDays * 86400000).getTime()
      : null

    const result: Day[] = []
    for (const day of snap.pendingDays) {
      const [y, m, d] = day.date.split("-").map(Number)
      const dayDate = new Date(y, m - 1, d).getTime()
      if (cutoff !== null && dayDate > cutoff) continue

      let payments = day.payments
      if (q) {
        payments = payments.filter((p) =>
          [p.description, String(p.id), p.buyer, p.externalReference, p.paymentMethodId]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(q))
        )
        if (payments.length === 0) continue
      }
      const total = payments.reduce((s, p) => s + p.netAmount, 0)
      result.push({
        date: day.date,
        total: Math.round(total * 100) / 100,
        count: payments.length,
        payments,
      })
    }
    return result
  }, [snap, periodFilter, searchQuery])

  const filteredTotal = useMemo(
    () => filteredDays.reduce((s, d) => s + d.total, 0),
    [filteredDays]
  )
  const filteredCount = useMemo(
    () => filteredDays.reduce((s, d) => s + d.count, 0),
    [filteredDays]
  )
  const hasFilters = periodFilter !== "all" || searchQuery.trim().length > 0
  const totalPendingCount = snap?.pendingCount ?? 0
  const disputedPaymentsList = snap?.disputedPayments ?? []

  // Caso especial: MP não conectado
  if (notConfigured) {
    return (
      <Card className="border-sky-200 bg-sky-50/40">
        <CardContent className="pt-6 pb-6 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-900">Mercado Pago não conectado</p>
            <p className="text-sm text-gray-600 mt-0.5">
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
        <div className="text-xs text-gray-500">
          {neverSynced ? (
            <span className="text-amber-700">
              Nunca sincronizado — clique em Atualizar pra puxar os dados do MP.
            </span>
          ) : cachedLabel ? (
            <>
              Última atualização: <strong className="text-gray-700">{cachedLabel}</strong>
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

      {/* Grid: A liberar · Retido */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SummaryCard
          tone="sky"
          icon={<Clock className="w-5 h-5" />}
          label="Total a liberar"
          value={snap?.unavailableBalance ?? 0}
          sub={`${totalPendingCount} pagamento${totalPendingCount === 1 ? "" : "s"} aguardando liberação`}
          loading={loading && !snap}
        />
        <SummaryCard
          tone={snap?.disputedCount && snap.disputedCount > 0 ? "amber" : "emerald"}
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Retido por reclamação"
          value={snap?.disputedTotal ?? 0}
          sub={
            snap?.disputedCount && snap.disputedCount > 0
              ? `${snap.disputedCount} pagamento${snap.disputedCount === 1 ? "" : "s"} em mediação · responda no app do MP pra destravar`
              : "Sem reclamações em aberto"
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
                      <div className="text-sm text-gray-900 line-clamp-1">{p.description}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="font-mono">#{p.id}</span>
                        {p.dateCreated && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>
                              aprovado {new Date(p.dateCreated).toLocaleDateString("pt-BR")}
                            </span>
                          </>
                        )}
                        {method && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{method}</span>
                          </>
                        )}
                        {p.buyer && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{p.buyer}</span>
                          </>
                        )}
                        {statusLabel && (
                          <>
                            <span className="text-gray-300">·</span>
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

      {/* Liberações por dia */}
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" />
              Liberações programadas
            </CardTitle>
            {hasFilters && snap?.pendingDays && (
              <span className="text-xs text-gray-500">
                {filteredCount} de {totalPendingCount} pagamento{totalPendingCount === 1 ? "" : "s"} ·{" "}
                <strong className="text-emerald-600">{formatCurrency(filteredTotal)}</strong>
              </span>
            )}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {([
                { key: "7", label: "7 dias" },
                { key: "15", label: "15 dias" },
                { key: "30", label: "30 dias" },
                { key: "all", label: "Todos" },
              ] as const).map((opt) => {
                const active = periodFilter === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => setPeriodFilter(opt.key)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                      active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            <div className="flex-1 min-w-[200px] relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por id, comprador, descrição..."
                className="w-full px-3 py-1.5 pr-8 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                  title="Limpar"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !snap ? (
            <div className="px-5 py-8 flex items-center justify-center text-gray-500">
              <Loader className="w-4 h-4 animate-spin mr-2" />
              Carregando...
            </div>
          ) : !snap?.pendingDays || snap.pendingDays.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">
              {neverSynced
                ? "Clique em Atualizar pra buscar os dados do Mercado Pago."
                : "Nenhum pagamento pendente de liberação."}
            </div>
          ) : filteredDays.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">
              Nenhum pagamento casa com esses filtros.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredDays.map((day) => {
                const open = expandedDays.has(day.date)
                return (
                  <li key={day.date}>
                    <button
                      onClick={() => toggleDay(day.date)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-left"
                    >
                      {open ? (
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {formatDayLabel(day.date)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {day.count} pagamento{day.count === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-emerald-600 tabular-nums whitespace-nowrap">
                        {formatCurrency(day.total)}
                      </div>
                    </button>
                    {open && (
                      <ul className="bg-gray-50 divide-y divide-gray-100 border-t border-gray-100">
                        {day.payments.map((p) => {
                          const method = p.paymentMethodId
                            ? METHOD_LABELS[p.paymentMethodId] || p.paymentMethodId
                            : null
                          return (
                            <li
                              key={p.id}
                              className="px-12 py-2.5 flex items-center gap-3 flex-wrap"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-900 line-clamp-1">
                                  {p.description}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                                  <span className="font-mono">#{p.id}</span>
                                  {method && (
                                    <>
                                      <span className="text-gray-300">·</span>
                                      <span>{method}</span>
                                    </>
                                  )}
                                  {p.buyer && (
                                    <>
                                      <span className="text-gray-300">·</span>
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
                                  <div className="text-xs text-gray-400 line-through tabular-nums">
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  tone,
  icon,
  label,
  value,
  sub,
  loading,
  action,
}: {
  tone: "sky" | "amber" | "emerald"
  icon: React.ReactNode
  label: string
  value: number
  sub: string
  loading?: boolean
  action?: React.ReactNode
}) {
  const toneMap: Record<string, { bg: string; border: string; iconBg: string; valueColor: string; labelColor: string }> = {
    sky: {
      bg: "bg-gradient-to-br from-sky-50 to-white",
      border: "border-sky-200",
      iconBg: "bg-sky-100 text-sky-700",
      valueColor: "text-gray-900",
      labelColor: "text-sky-700",
    },
    amber: {
      bg: "bg-gradient-to-br from-amber-50 to-white",
      border: "border-amber-200",
      iconBg: "bg-amber-100 text-amber-700",
      valueColor: "text-amber-700",
      labelColor: "text-amber-800",
    },
    emerald: {
      bg: "bg-white",
      border: "border-gray-200",
      iconBg: "bg-emerald-100 text-emerald-700",
      valueColor: "text-gray-900",
      labelColor: "text-emerald-700",
    },
  }
  const t = toneMap[tone]

  return (
    <Card className={`${t.border} ${t.bg}`}>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg ${t.iconBg} flex items-center justify-center shrink-0`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium ${t.labelColor} uppercase tracking-wide`}>{label}</p>
            <p className={`text-3xl font-bold ${t.valueColor} mt-0.5 tabular-nums`}>
              {loading ? "—" : formatCurrency(value)}
            </p>
            <p className="text-xs text-gray-600 mt-1">{sub}</p>
            {action}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
