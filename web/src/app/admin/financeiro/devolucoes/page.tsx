"use client"

import { useEffect, useMemo, useState } from "react"
import { formatCurrency } from "@/lib/calculations"
import { RotateCcw, AlertCircle, ExternalLink, RefreshCw, Lock } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import { KpiCard } from "@/components/ui/kpi-card"
import { ProductLabel } from "@/components/ProductLabel"
import { feedback } from "@/lib/feedback"

interface RefundItem {
  id: string
  amount: number
  costRefunded: number | null
  refundedAt: string
  source: string
  reason: string | null
  mlOrderId: string | null
  bill: {
    id: string
    title: string
    variation: string | null
    mlListingId: string | null
    amount: number
    productCost: number | null
    paidDate: string | null
  }
}

interface ApiResponse {
  items: RefundItem[]
  total: number
  totalAmount: number
  totalCostRefunded: number
  period: { start: string; end: string }
}

interface DisputedPayment {
  id: number
  description: string
  netAmount: number
  grossAmount: number
  statusDetail?: string | null
  buyer: string | null
}

interface MpSnapshot {
  configured: boolean
  disputedTotal?: number
  disputedCount?: number
  disputedPayments?: DisputedPayment[]
  cachedSyncedAt?: string | null
}

const SOURCE_LABELS: Record<string, { label: string; tone: string }> = {
  ml_order_cancelled: { label: "Pedido cancelado", tone: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  ml_partial_refund: { label: "Reembolso parcial", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  manual: { label: "Manual", tone: "bg-muted text-muted-foreground" },
}

const STATUS_DETAIL_LABELS: Record<string, string> = {
  in_mediation: "Em mediação",
  pending_waiting_buyer: "Aguardando comprador",
  pending_waiting_review: "Em análise do MP",
}

type RangePreset = "current_month" | "last_30" | "last_60" | "since_march" | "custom"

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function defaultRange(): { start: string; end: string } {
  const now = new Date()
  const start = ymd(new Date(now.getFullYear(), now.getMonth(), 1))
  const end = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 1))
  return { start, end }
}

function rangeFromPreset(preset: RangePreset): { start: string; end: string } | null {
  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  switch (preset) {
    case "current_month":
      return defaultRange()
    case "last_30": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
      return { start: ymd(start), end: ymd(tomorrow) }
    }
    case "last_60": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60)
      return { start: ymd(start), end: ymd(tomorrow) }
    }
    case "since_march": {
      const start = new Date(now.getFullYear(), 2, 1) // 1º de março
      return { start: ymd(start), end: ymd(tomorrow) }
    }
    default:
      return null
  }
}

export default function DevolucoesPage() {
  const [preset, setPreset] = useState<RangePreset>("current_month")
  const [range, setRange] = useState<{ start: string; end: string }>(defaultRange())
  const [data, setData] = useState<ApiResponse | null>(null)
  const [mpSnap, setMpSnap] = useState<MpSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch(`/api/financeiro/devolucoes?start=${range.start}&end=${range.end}`).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`/api/mp/snapshot`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([refunds, snap]) => {
        setData(refunds)
        setMpSnap(snap)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end])

  const onPresetChange = (p: RangePreset) => {
    setPreset(p)
    const r = rangeFromPreset(p)
    if (r) setRange(r)
  }

  const onSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`/api/financeiro/devolucoes/sync?since=${range.start}`, {
        method: "POST",
      })
      const json = await res.json()
      if (!res.ok) {
        feedback.error(json.error || "Falha ao sincronizar devoluções")
        return
      }
      const s = json.stats
      const novas = (s?.canceladas ?? 0) + (s?.parciais ?? 0)
      if (novas === 0) {
        feedback.info(`Nenhuma devolução nova. Verificadas: ${s?.verificadas ?? 0} vendas.`)
      } else {
        feedback.success(
          `${novas} devolução(ões) detectada(s) — ${s?.canceladas ?? 0} total(ais), ${s?.parciais ?? 0} parcial(is).`,
        )
      }
      load()
    } catch {
      feedback.error("Erro ao sincronizar")
    } finally {
      setSyncing(false)
    }
  }

  const lucroPerdido = useMemo(() => {
    if (!data) return 0
    return data.totalAmount - data.totalCostRefunded
  }, [data])

  const disputedList = mpSnap?.disputedPayments ?? []
  const disputedTotal = mpSnap?.disputedTotal ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="↩️ Devoluções"
        description="Pedidos cancelados e reembolsos parciais detectados automaticamente do Mercado Livre."
      />

      {/* Filtros + sync */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={preset}
            onChange={(e) => onPresetChange(e.target.value as RangePreset)}
            className="border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 outline-none"
          >
            <option value="current_month">Mês atual</option>
            <option value="last_30">Últimos 30 dias</option>
            <option value="last_60">Últimos 60 dias</option>
            <option value="since_march">Desde 1º de março</option>
            <option value="custom">Período personalizado</option>
          </select>
          {preset === "custom" && (
            <>
              <input
                type="date"
                value={range.start}
                onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                className="border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 outline-none"
              />
              <span className="text-muted-foreground text-sm">até</span>
              <input
                type="date"
                value={range.end}
                onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                className="border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 outline-none"
              />
            </>
          )}
        </div>
        <Button onClick={onSync} disabled={syncing} variant="outline" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar com ML"}
        </Button>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard
          label="Devoluções no período"
          value={data?.total ?? 0}
          accent={data && data.total > 0 ? "rose" : "default"}
        />
        <KpiCard
          label="Total devolvido"
          value={formatCurrency(data?.totalAmount ?? 0)}
          sub="valor líquido (após taxas) que voltou ao comprador"
          accent="rose"
        />
        <KpiCard
          label="Lucro perdido"
          value={formatCurrency(lucroPerdido)}
          sub="devolvido − custo de mercadoria revertido"
          accent="amber"
        />
      </div>

      {/* Pagamentos retidos por reclamação — alerta separado */}
      {mpSnap?.configured && disputedList.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/20">
          <div className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">
                  ⚠️ Pagamentos retidos por reclamação ({mpSnap.disputedCount})
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>{formatCurrency(disputedTotal)}</strong> bloqueado(s) no Mercado Pago. Não são devoluções <em>ainda</em> — mas viram se a reclamação for resolvida em favor do comprador. Responda no app do MP pra destravar.
                </p>
              </div>
            </div>
            <div className="border-t border-amber-200 pt-3">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left py-1">Comprador</th>
                    <th className="text-left py-1">Status</th>
                    <th className="text-right py-1">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {disputedList.slice(0, 10).map((p) => (
                    <tr key={p.id} className="border-t border-amber-200/50">
                      <td className="py-2 truncate max-w-xs">{p.buyer || p.description}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {STATUS_DETAIL_LABELS[p.statusDetail || ""] || p.statusDetail || "—"}
                      </td>
                      <td className="py-2 text-right font-mono text-amber-700 dark:text-amber-400">
                        {formatCurrency(p.netAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {disputedList.length > 10 && (
                <p className="text-xs text-muted-foreground mt-2">
                  +{disputedList.length - 10} pagamento(s) — veja todos em{" "}
                  <a href="/admin/financeiro/mercado-pago" className="text-primary-600 hover:underline">
                    Mercado Pago
                  </a>
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Lista principal de devoluções */}
      <Card className="overflow-hidden">
        {loading ? (
          <LoadingState variant="card" label="Carregando devoluções..." />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={RotateCcw}
            title="Nenhuma devolução no período"
            description="Se você sabe que houve devolução, clique em 'Sincronizar com ML' acima — o cron diário pode não ter rodado ainda."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Data</th>
                  <th className="px-4 py-3 text-left">Produto</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Venda</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Devolvido</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">CMV revertido</th>
                  <th className="px-4 py-3 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((it) => {
                  const meta = SOURCE_LABELS[it.source] ?? SOURCE_LABELS.manual
                  return (
                    <tr key={it.id} className="hover:bg-accent">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(it.refundedAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        <ProductLabel
                          title={it.bill.title}
                          variation={it.bill.variation}
                          mlListingId={it.bill.mlListingId}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${meta.tone}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                        {formatCurrency(it.bill.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600 whitespace-nowrap">
                        −{formatCurrency(it.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {it.costRefunded != null ? formatCurrency(it.costRefunded) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {it.mlOrderId && (
                          <a
                            href={`/admin/relatorios/vendas-ml?orderId=${it.mlOrderId.replace(/^order_/, "")}`}
                            className="inline-flex items-center justify-center text-muted-foreground hover:text-primary-600"
                            title="Ver venda original"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-muted/50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-rose-600 whitespace-nowrap">
                    −{formatCurrency(data.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {formatCurrency(data.totalCostRefunded)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <div className="flex items-start gap-2 bg-muted/40 rounded-lg px-4 py-3 text-xs text-muted-foreground">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          Devoluções são detectadas pelo cron diário ou no momento em que o pedido é
          atualizado no ML. Refunds parciais reduzem a receita proporcionalmente;
          pedidos cancelados zeram a venda. CMV revertido = custo da mercadoria que
          volta pro estoque (quando a venda tem custo cadastrado).
        </p>
      </div>
    </div>
  )
}
