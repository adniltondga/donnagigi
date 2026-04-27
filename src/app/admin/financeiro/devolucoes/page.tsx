"use client"

import { useEffect, useMemo, useState } from "react"
import { formatCurrency } from "@/lib/calculations"
import { RotateCcw, AlertCircle, ExternalLink } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import { KpiCard } from "@/components/ui/kpi-card"
import { ProductLabel } from "@/components/ProductLabel"

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

const SOURCE_LABELS: Record<string, { label: string; tone: string }> = {
  ml_order_cancelled: { label: "Pedido cancelado", tone: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  ml_partial_refund: { label: "Reembolso parcial", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  manual: { label: "Manual", tone: "bg-muted text-muted-foreground" },
}

function currentMonthYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function ymToRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number)
  const start = new Date(y, m - 1, 1).toISOString().slice(0, 10)
  const end = new Date(y, m, 1).toISOString().slice(0, 10)
  return { start, end }
}

export default function DevolucoesPage() {
  const [month, setMonth] = useState(currentMonthYM())
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const { start, end } = ymToRange(month)
    fetch(`/api/financeiro/devolucoes?start=${start}&end=${end}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ApiResponse | null) => setData(d))
      .finally(() => setLoading(false))
  }, [month])

  const lucroPerdido = useMemo(() => {
    if (!data) return 0
    return data.totalAmount - data.totalCostRefunded
  }, [data])

  return (
    <div className="space-y-6">
      <PageHeader
        title="↩️ Devoluções"
        description="Pedidos cancelados e reembolsos parciais detectados automaticamente do Mercado Livre."
        actions={
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 outline-none"
          />
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard
          label="Devoluções no mês"
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

      <Card className="overflow-hidden">
        {loading ? (
          <LoadingState variant="card" label="Carregando devoluções..." />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={RotateCcw}
            title="Nenhuma devolução no período"
            description="Quando o ML registrar pedido cancelado ou reembolso, aparece aqui automaticamente."
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
          As devoluções são detectadas automaticamente pelo cron diário ou no momento
          em que o pedido é atualizado no ML. Refunds parciais reduzem a receita
          proporcionalmente; pedidos cancelados zeram a venda. CMV revertido = custo
          da mercadoria que volta pro estoque (quando a venda tem custo cadastrado).
        </p>
      </div>
    </div>
  )
}
