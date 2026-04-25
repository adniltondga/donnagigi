"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Package,
  Loader2,
  AlertCircle,
  ArrowRight,
  Wallet,
} from "lucide-react"
import { formatCurrency } from "@/lib/calculations"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { SummaryCard } from "@/components/ui/summary-card"

interface Me {
  id: string
  name: string
  email: string
  tenant: { id: string; name: string; slug: string }
}

interface MLStatus {
  connected: boolean
  sellerID?: string
  isExpired?: boolean
}

interface V2Response {
  kpisAtual: { vendas: number; bruto: number; lucro: number; custo: number }
  kpisAnterior: { vendas: number; bruto: number; lucro: number; custo: number }
  derivados: { margemPct: number; margemPctAnterior: number }
  cancelamentos: { vendas: number; bruto: number; taxaPct: number }
  timeline: Array<{ date: string; pedidos: number; vendas: number; bruto: number; lucro: number }>
}

interface MpPendingDay {
  date: string // YYYY-MM-DD
  total: number
  count: number
}

interface MpSnapshot {
  configured: boolean
  pendingDays?: MpPendingDay[]
  cachedSyncedAt?: string | null
}

function firstDayOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function lastDayOfMonth(): string {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`
}

function firstName(n?: string): string {
  if (!n) return ""
  return n.split(" ")[0]
}

function deltaBadge(curr: number, prev: number): { label: string; positive: boolean | null } {
  if (prev === 0) return curr === 0 ? { label: "—", positive: null } : { label: "+ novo", positive: true }
  const pct = ((curr - prev) / Math.abs(prev)) * 100
  return {
    label: `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`,
    positive: pct >= 0,
  }
}

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null)
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null)
  const [v2, setV2] = useState<V2Response | null>(null)
  const [mpSnapshot, setMpSnapshot] = useState<MpSnapshot | null>(null)
  const [receivableMonth, setReceivableMonth] = useState<{ count: number; amount: number } | null>(null)
  const [payableMonth, setPayableMonth] = useState<{ count: number; amount: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const from = firstDayOfMonth()
        const to = today()
        const monthEnd = lastDayOfMonth()

        const [meRes, mlRes, v2Res, mpRes, manualReceivableRes, payableRes] = await Promise.all([
          fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/ml/status").then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/relatorios/v2?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/mp/snapshot`).then((r) => (r.ok ? r.json() : null)),
          // Manuais: receivable pending, excluindo vendas ML (que já vêm do MP).
          fetch(
            `/api/bills?type=receivable&status=pending&excludeCategory=venda&dueFrom=${from}&dueTo=${monthEnd}&limit=500`
          ).then((r) => (r.ok ? r.json() : null)),
          fetch(
            `/api/bills?type=payable&status=pending&dueFrom=${from}&dueTo=${monthEnd}&limit=500`
          ).then((r) => (r.ok ? r.json() : null)),
        ])

        setMe(meRes)
        setMlStatus(mlRes)
        setV2(v2Res)
        setMpSnapshot(mpRes)

        // Agrega MP (do mês) + manuais. Se MP não configurado/erro, só usa manuais.
        let rxCount = 0
        let rxAmount = 0
        if (mpRes?.configured && Array.isArray(mpRes?.pendingDays)) {
          for (const d of mpRes.pendingDays as Array<{ date: string; total: number; count: number }>) {
            if (d.date >= from && d.date <= monthEnd) {
              rxCount += d.count
              rxAmount += d.total
            }
          }
        }
        if (manualReceivableRes?.data) {
          rxCount += manualReceivableRes.total ?? manualReceivableRes.data.length
          rxAmount += manualReceivableRes.data.reduce(
            (s: number, b: any) => s + (b.amount || 0),
            0
          )
        }
        setReceivableMonth({ count: rxCount, amount: rxAmount })

        if (payableRes?.data) {
          const count = payableRes.total ?? payableRes.data.length
          const amount = payableRes.data.reduce((s: number, b: any) => s + (b.amount || 0), 0)
          setPayableMonth({ count, amount })
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const kpis = v2?.kpisAtual
  const kpisPrev = v2?.kpisAnterior
  const timeline7d = v2?.timeline?.slice(-7) || []
  const vendasHoje = v2?.timeline?.find((t) => t.date === today())
  // Próximas liberações MP — vem do cache do /api/mp/snapshot.
  // Pega os 5 primeiros dias com money_release_date no futuro.
  const nowMs = Date.now()
  const proximasLiberacoes = (mpSnapshot?.pendingDays || [])
    .filter((d) => {
      const [y, m, dd] = d.date.split("-").map(Number)
      return new Date(y, m - 1, dd).getTime() >= nowMs - 86400000 // inclui hoje
    })
    .slice(0, 5)
    .map((d) => {
      const [, , dd] = d.date.split("-").map(Number)
      return { dia: dd, date: d.date, vendas: d.count, totalVenda: d.total }
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Carregando dashboard...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Olá, ${firstName(me?.name)}! 👋`}
        description={
          me?.tenant?.name
            ? `Aqui está um resumo da ${me.tenant.name} hoje.`
            : "Aqui está um resumo do seu negócio."
        }
      />

      {/* Status ML */}
      {!mlStatus?.connected ? (
        <div className="bg-gradient-to-r from-primary-600 to-fuchsia-600 text-white rounded-xl p-6 flex items-center justify-between shadow-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-8 h-8 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-bold">Conecte seu Mercado Livre</h2>
              <p className="text-white/90 text-sm mt-1">
                Em 1 clique a gente começa a sincronizar suas vendas, taxas e liberações.
              </p>
            </div>
          </div>
          <a
            href="/api/ml/oauth/login"
            className="bg-white text-primary-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-primary-50 transition flex items-center gap-2 whitespace-nowrap"
          >
            Conectar agora
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      ) : mlStatus.isExpired ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-semibold text-sm">Token do Mercado Livre expirou</p>
              <p className="text-xs text-amber-800">Reconecte pra voltar a sincronizar.</p>
            </div>
          </div>
          <a
            href="/api/ml/oauth/login"
            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-700 transition"
          >
            Reconectar
          </a>
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/admin/relatorios/vendas-ml"
          className="block rounded-xl transition hover:scale-[1.01] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <SummaryCard
            label="Vendas hoje"
            value={
              vendasHoje
                ? `${vendasHoje.pedidos} venda${vendasHoje.pedidos === 1 ? "" : "s"}`
                : "—"
            }
            sub={vendasHoje ? formatCurrency(vendasHoje.bruto) : "sem vendas ainda"}
            icon={TrendingUp}
            tone="emerald"
            tooltip={
              vendasHoje
                ? `${vendasHoje.vendas} unidade${vendasHoje.vendas === 1 ? "" : "s"} vendida${vendasHoje.vendas === 1 ? "" : "s"}`
                : undefined
            }
          />
        </Link>
        <SummaryCard
          label="Lucro do mês"
          value={kpis ? formatCurrency(kpis.lucro) : "—"}
          sub={
            kpis && kpisPrev
              ? (() => {
                  const d = deltaBadge(kpis.lucro, kpisPrev.lucro)
                  return `${d.label} vs mês anterior`
                })()
              : "—"
          }
          icon={Package}
          tone="primary"
        />
        <SummaryCard
          label="A receber (mês)"
          value={receivableMonth ? formatCurrency(receivableMonth.amount) : "—"}
          sub={
            receivableMonth
              ? `${receivableMonth.count} conta${receivableMonth.count === 1 ? "" : "s"} pendente${
                  receivableMonth.count === 1 ? "" : "s"
                }`
              : "sem contas no mês"
          }
          icon={DollarSign}
          tone="amber"
        />
        <SummaryCard
          label="A pagar (mês)"
          value={payableMonth ? formatCurrency(payableMonth.amount) : "—"}
          sub={
            payableMonth
              ? `${payableMonth.count} conta${payableMonth.count === 1 ? "" : "s"} pendente${
                  payableMonth.count === 1 ? "" : "s"
                }`
              : "sem contas no mês"
          }
          icon={Wallet}
          tone="sky"
        />
      </div>

      {/* Tendência 7d */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            Últimos 7 dias
          </h2>
          <Link
            href="/admin/relatorios-v2"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Ver completo →
          </Link>
        </div>
        {timeline7d.length > 0 && timeline7d.some((p) => p.bruto > 0) ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline7d} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const d = new Date(`${v}T12:00:00`)
                    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                />
                <Tooltip
                  formatter={(v: any) => formatCurrency(Number(v))}
                  labelFormatter={(label: any) => {
                    const d = new Date(`${String(label)}T12:00:00`)
                    return d.toLocaleDateString("pt-BR")
                  }}
                />
                <Line type="monotone" dataKey="bruto" stroke="#7c3aed" strokeWidth={2} dot={false} name="Bruto" />
                <Line type="monotone" dataKey="lucro" stroke="#10b981" strokeWidth={2} dot={false} name="Lucro" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyInline message="Nenhuma venda nos últimos 7 dias" />
        )}
      </Card>

      {/* Próximas liberações + Devoluções */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Próximas liberações Mercado Pago
            </h2>
            <Link
              href="/admin/financeiro/mercado-pago"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Ver previsão completa →
            </Link>
          </div>
          {mpSnapshot && !mpSnapshot.configured ? (
            <EmptyInline message="Conecte seu Mercado Pago em Configurações → Integrações" />
          ) : proximasLiberacoes.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {proximasLiberacoes.map((d) => (
                <li key={d.date} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-50 text-primary-700 rounded-lg flex flex-col items-center justify-center leading-none">
                      <span className="text-xs font-semibold">DIA</span>
                      <span className="text-base font-bold">{String(d.dia).padStart(2, "0")}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {d.vendas} pagamento{d.vendas === 1 ? "" : "s"}
                      </p>
                      <p className="text-xs text-gray-500">libera no Mercado Pago</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">{formatCurrency(d.totalVenda)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : mpSnapshot?.cachedSyncedAt ? (
            <EmptyInline message="Nada liberando nos próximos dias" />
          ) : (
            <EmptyInline message="Abra Financeiro → Mercado Pago e clique em Atualizar" />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-gray-900 mb-4">↩️ Devoluções (mês)</h2>
          {v2?.cancelamentos ? (
            <div className="space-y-3">
              <div>
                <p className="text-3xl font-bold text-gray-900">{v2.cancelamentos.vendas}</p>
                <p className="text-xs text-gray-500">unidade(s) devolvida(s)</p>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <p className="text-sm text-red-600 font-semibold">
                  - {formatCurrency(v2.cancelamentos.bruto)}
                </p>
                <p className="text-xs text-gray-500">
                  {v2.cancelamentos.taxaPct.toFixed(1)}% das vendas do mês
                </p>
              </div>
            </div>
          ) : (
            <EmptyInline message="—" />
          )}
        </Card>
      </div>

    </div>
  )
}

function EmptyInline({ message }: { message: string }) {
  return <div className="text-center text-sm text-gray-400 py-8">{message}</div>
}
