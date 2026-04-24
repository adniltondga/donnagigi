"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { Loader, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { CalendarClock, AlertTriangle, Wallet } from "lucide-react"
import { formatCurrency } from "@/lib/calculations"

type Kind = "recebimentos" | "pagamentos"
type Preset = "hoje" | "7dias" | "mes" | "custom"

interface Props {
  kind: Kind
}

interface DayBucket {
  date: string // YYYY-MM-DD
  day: number  // dia do mês (1-31) — rótulo do eixo X
  label: string // "24/04"
  mp: number
  manual: number
  total: number
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function firstOfMonth(): string {
  const d = new Date()
  return ymd(new Date(d.getFullYear(), d.getMonth(), 1))
}

function lastOfMonth(): string {
  const d = new Date()
  return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

function todayISO(): string {
  return ymd(new Date())
}

function plusDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return ymd(dt)
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  const start = new Date(fy, fm - 1, fd)
  const end = new Date(ty, tm - 1, td)
  if (start > end) return out
  const cursor = new Date(start)
  while (cursor <= end) {
    out.push(ymd(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export function FluxoDiarioReport({ kind }: Props) {
  const [from, setFrom] = useState<string>(firstOfMonth())
  const [to, setTo] = useState<string>(lastOfMonth())
  const [preset, setPreset] = useState<Preset>("mes")
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<DayBucket[]>([])

  const applyPreset = (p: Preset) => {
    setPreset(p)
    if (p === "hoje") {
      const t = todayISO()
      setFrom(t)
      setTo(t)
    } else if (p === "7dias") {
      const t = todayISO()
      setFrom(t)
      setTo(plusDays(t, 6))
    } else if (p === "mes") {
      setFrom(firstOfMonth())
      setTo(lastOfMonth())
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const billType = kind === "recebimentos" ? "receivable" : "payable"
      // Recebimentos manuais excluem vendas ML (que entram via MP); pagamentos
      // não excluem nada — vêm do Contas a pagar puro.
      const billsUrl =
        kind === "recebimentos"
          ? `/api/bills?type=${billType}&status=pending&excludeCategory=venda&dueFrom=${from}&dueTo=${to}&limit=1000`
          : `/api/bills?type=${billType}&status=pending&dueFrom=${from}&dueTo=${to}&limit=1000`

      const billsPromise = fetch(billsUrl).then((r) => (r.ok ? r.json() : null))
      const mpPromise =
        kind === "recebimentos"
          ? fetch("/api/mp/snapshot").then((r) => (r.ok ? r.json() : null))
          : Promise.resolve(null)

      const [billsRes, mpRes] = await Promise.all([billsPromise, mpPromise])

      const manualByDay = new Map<string, number>()
      for (const b of (billsRes?.data || []) as Array<{ dueDate: string; amount: number }>) {
        const d = b.dueDate.slice(0, 10)
        manualByDay.set(d, (manualByDay.get(d) || 0) + Number(b.amount || 0))
      }

      const mpByDay = new Map<string, number>()
      if (mpRes?.configured && Array.isArray(mpRes.pendingDays)) {
        for (const d of mpRes.pendingDays as Array<{ date: string; total: number }>) {
          if (d.date >= from && d.date <= to) {
            mpByDay.set(d.date, (mpByDay.get(d.date) || 0) + Number(d.total || 0))
          }
        }
      }

      const buckets = eachDay(from, to).map((iso) => {
        const [, mm, dd] = iso.split("-").map(Number)
        const mp = Math.round((mpByDay.get(iso) || 0) * 100) / 100
        const manual = Math.round((manualByDay.get(iso) || 0) * 100) / 100
        return {
          date: iso,
          day: dd,
          label: `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}`,
          mp,
          manual,
          total: Math.round((mp + manual) * 100) / 100,
        }
      })
      setDays(buckets)
    } finally {
      setLoading(false)
    }
  }, [kind, from, to])

  useEffect(() => {
    load()
  }, [load])

  const total = useMemo(() => days.reduce((s, d) => s + d.total, 0), [days])
  const totalMp = useMemo(() => days.reduce((s, d) => s + d.mp, 0), [days])
  const totalManual = useMemo(() => days.reduce((s, d) => s + d.manual, 0), [days])
  const diasAtivos = useMemo(() => days.filter((d) => d.total > 0).length, [days])

  const palette = kind === "recebimentos"
    ? { mp: "#0ea5e9", manual: "#10b981", accent: "emerald" as const }
    : { mp: "#ef4444", manual: "#dc2626", accent: "rose" as const }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-5 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {([
              { key: "hoje", label: "Hoje" },
              { key: "7dias", label: "7 dias" },
              { key: "mes", label: "Este mês" },
              { key: "custom", label: "Custom" },
            ] as const).map((opt) => {
              const active = preset === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => applyPreset(opt.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                setPreset("custom")
              }}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Até</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                setPreset("custom")
              }}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="ml-auto">
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label={kind === "recebimentos" ? "Total a receber" : "Total a pagar"}
          value={formatCurrency(total)}
          sub={`${diasAtivos} dia${diasAtivos === 1 ? "" : "s"} com movimento`}
          icon={Wallet}
          accent={palette.accent}
        />
        {kind === "recebimentos" && (
          <StatCard
            label="Mercado Pago"
            value={formatCurrency(totalMp)}
            sub="liberações programadas"
            icon={CalendarClock}
            accent="sky"
          />
        )}
        <StatCard
          label={kind === "recebimentos" ? "Lançamentos manuais" : "Contas cadastradas"}
          value={formatCurrency(totalManual)}
          sub={kind === "recebimentos" ? "bills receivable (sem vendas ML)" : "bills payable pendentes"}
          icon={AlertTriangle}
          accent={kind === "recebimentos" ? "amber" : "rose"}
        />
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {kind === "recebimentos" ? "Recebimentos por dia" : "Pagamentos por dia"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader className="w-5 h-5 animate-spin mr-2" />
              Calculando...
            </div>
          ) : days.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              Período inválido. Ajuste as datas.
            </div>
          ) : (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval={days.length > 20 ? "preserveStartEnd" : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(Number(value) || 0),
                      name === "mp" ? "Mercado Pago" : "Manual",
                    ]}
                    labelFormatter={(label) => `Dia ${label}`}
                  />
                  {kind === "recebimentos" && (
                    <Bar dataKey="mp" name="mp" stackId="a" fill={palette.mp} radius={[0, 0, 0, 0]} />
                  )}
                  <Bar
                    dataKey="manual"
                    name="manual"
                    stackId="a"
                    fill={palette.manual}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
