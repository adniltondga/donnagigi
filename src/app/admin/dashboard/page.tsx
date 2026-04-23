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
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  FileText,
  Settings,
} from "lucide-react"
import { formatCurrency } from "@/lib/calculations"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"

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
  timeline: Array<{ date: string; vendas: number; bruto: number; lucro: number }>
  topPorLucro: Array<{ name: string; mlListingId: string | null; vendas: number; lucro: number; margem: number }>
}

interface PrevisaoResponse {
  total: number
  totalVendas: number
  dias: Array<{ dia: number; vendas: number; totalVenda: number }>
}

function firstDayOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
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
  const [prev, setPrev] = useState<PrevisaoResponse | null>(null)
  const [pendingCount, setPendingCount] = useState<{ count: number; amount: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const from = firstDayOfMonth()
        const to = today()

        const [meRes, mlRes, v2Res, prevRes, billsRes] = await Promise.all([
          fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/ml/status").then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/relatorios/v2?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/relatorios/previsao`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/bills?type=receivable&status=pending&category=venda&limit=200`).then((r) =>
            r.ok ? r.json() : null
          ),
        ])

        setMe(meRes)
        setMlStatus(mlRes)
        setV2(v2Res)
        setPrev(prevRes)
        if (billsRes?.data) {
          const count = billsRes.total ?? billsRes.data.length
          const amount = billsRes.data.reduce((s: number, b: any) => s + (b.amount || 0), 0)
          setPendingCount({ count, amount })
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const vendasHoje = v2?.timeline?.find((t) => t.date === today())
  const kpis = v2?.kpisAtual
  const kpisPrev = v2?.kpisAnterior
  const timeline7d = v2?.timeline?.slice(-7) || []
  const proximasLiberacoes = prev?.dias?.filter((d) => d.totalVenda > 0).slice(0, 5) || []

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
      ) : (
        <div className="bg-green-50 border border-green-200 text-green-900 rounded-xl p-3 flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span>
            Mercado Livre conectado · seller <strong>{mlStatus.sellerID}</strong>
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Vendas hoje"
          value={vendasHoje ? `${vendasHoje.vendas} un.` : "—"}
          sub={vendasHoje ? formatCurrency(vendasHoje.bruto) : "sem vendas ainda"}
          icon={TrendingUp}
          accent="emerald"
        />
        <StatCard
          label="A receber (ML)"
          value={pendingCount ? `${pendingCount.count}` : "—"}
          sub={pendingCount ? formatCurrency(pendingCount.amount) : "nenhuma pendente"}
          icon={DollarSign}
          accent="amber"
        />
        <StatCard
          label="Libera neste mês"
          value={prev ? `${prev.totalVendas} un.` : "—"}
          sub={prev ? formatCurrency(prev.total) : "—"}
          icon={Calendar}
          accent="sky"
        />
        <StatCard
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
          accent="primary"
        />
      </div>

      {/* Tendência 7d + Top produtos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
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

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">🏆 Top produtos (mês)</h2>
          </div>
          {v2?.topPorLucro && v2.topPorLucro.length > 0 ? (
            <ul className="space-y-3">
              {v2.topPorLucro.slice(0, 5).map((p, i) => (
                <li key={`${p.mlListingId || p.name}-${i}`} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{p.name}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">{p.vendas} un.</span>
                      <span className="text-emerald-600 font-semibold">{formatCurrency(p.lucro)}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-600">{p.margem.toFixed(0)}%</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyInline message="Sem dados ainda" />
          )}
        </Card>
      </div>

      {/* Próximas liberações + Devoluções */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Próximas liberações
            </h2>
            <Link
              href="/admin/previsao"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Ver previsão completa →
            </Link>
          </div>
          {proximasLiberacoes.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {proximasLiberacoes.map((d) => (
                <li key={d.dia} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-50 text-primary-700 rounded-lg flex flex-col items-center justify-center leading-none">
                      <span className="text-xs font-semibold">DIA</span>
                      <span className="text-base font-bold">{String(d.dia).padStart(2, "0")}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {d.vendas} venda{d.vendas === 1 ? "" : "s"}
                      </p>
                      <p className="text-xs text-gray-500">entra no seu Mercado Pago</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">{formatCurrency(d.totalVenda)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyInline message="Nada liberando nesse mês" />
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

      {/* Quick Actions */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">Ações rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction
            href="/api/ml/sync-orders"
            external
            icon={<RefreshCw className="w-5 h-5" />}
            label="Sincronizar ML"
            desc="Buscar novos pedidos"
          />
          <QuickAction
            href="/admin/relatorios-v2"
            icon={<TrendingUp className="w-5 h-5" />}
            label="Ver relatório"
            desc="KPIs e top produtos"
          />
          <QuickAction
            href="/admin/financeiro"
            icon={<FileText className="w-5 h-5" />}
            label="Nova conta"
            desc="A pagar ou receber"
          />
          <QuickAction
            href="/admin/integracao"
            icon={<Settings className="w-5 h-5" />}
            label="Integração ML"
            desc="Reconectar se precisar"
          />
        </div>
      </div>
    </div>
  )
}

function QuickAction({
  href,
  icon,
  label,
  desc,
  external,
}: {
  href: string
  icon: React.ReactNode
  label: string
  desc: string
  external?: boolean
}) {
  const Comp: any = external ? "a" : Link
  return (
    <Comp
      href={href}
      className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-primary-300 hover:shadow-sm transition group"
    >
      <div className="w-10 h-10 bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 truncate">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition flex-shrink-0" />
    </Comp>
  )
}

function EmptyInline({ message }: { message: string }) {
  return <div className="text-center text-sm text-gray-400 py-8">{message}</div>
}
