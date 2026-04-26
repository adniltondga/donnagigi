"use client"

import { useEffect, useState } from "react"
import { Loader2, Search, Building2, Plug, Receipt, Tickets as TicketsIcon } from "lucide-react"

interface TenantRow {
  id: string
  name: string
  slug: string
  createdAt: string
  subscription: {
    plan: "FREE" | "PRO"
    status: "TRIAL" | "ACTIVE" | "PENDING" | "OVERDUE" | "CANCELED" | "EXPIRED"
    value: number | null
    trialEndsAt: string | null
    currentPeriodEnd: string | null
  } | null
  users: Array<{ id: string; name: string; email: string; role: string }>
  _count: {
    users: number
    tickets: number
    mlIntegrations: number
    bills: number
  }
  mpIntegration: { id: string } | null
}

const STATUS_TONE: Record<string, string> = {
  TRIAL: "bg-blue-900/40 text-blue-300 border-blue-800",
  ACTIVE: "bg-emerald-900/40 text-emerald-300 border-emerald-800",
  PENDING: "bg-amber-900/40 text-amber-300 border-amber-800",
  OVERDUE: "bg-red-900/40 text-red-300 border-red-800",
  CANCELED: "bg-zinc-800 text-zinc-500 border-zinc-700",
  EXPIRED: "bg-zinc-800 text-zinc-500 border-zinc-700",
}

const STATUS_LABEL: Record<string, string> = {
  TRIAL: "Trial",
  ACTIVE: "Ativo",
  PENDING: "Pendente",
  OVERDUE: "Atrasado",
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
}

function formatDate(s: string | null): string {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("pt-BR")
}

function formatCurrency(v: number | null): string {
  if (v == null) return "—"
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function StaffClientesPage() {
  const [tenants, setTenants] = useState<TenantRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [qInput, setQInput] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set("q", q)
      const res = await fetch(`/api/staff/clientes?${params}`)
      const data = await res.json()
      setTenants(data.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  // KPIs
  const kpis = tenants
    ? {
        total: tenants.length,
        active: tenants.filter((t) => t.subscription?.status === "ACTIVE").length,
        trial: tenants.filter((t) => t.subscription?.status === "TRIAL").length,
        ticketsOpen: tenants.reduce((s, t) => s + t._count.tickets, 0),
        mrr: tenants.reduce(
          (s, t) => (t.subscription?.status === "ACTIVE" ? s + (t.subscription?.value ?? 0) : s),
          0
        ),
      }
    : null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Clientes</h2>
          <p className="text-sm text-zinc-500">Todos os tenants e estado das integrações.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setQ(qInput.trim())
          }}
          className="relative"
        >
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Buscar por nome ou slug…"
            className="bg-zinc-900 border border-zinc-800 rounded-md pl-9 pr-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 w-72"
          />
        </form>
      </div>

      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI label="Total" value={String(kpis.total)} />
          <KPI label="Ativos" value={String(kpis.active)} accent="emerald" />
          <KPI label="Em trial" value={String(kpis.trial)} accent="blue" />
          <KPI label="Tickets abertos" value={String(kpis.ticketsOpen)} accent="amber" />
          <KPI label="MRR estimado" value={formatCurrency(kpis.mrr)} accent="primary" />
        </div>
      )}

      {loading ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 flex items-center justify-center text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Carregando…
        </div>
      ) : tenants && tenants.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center text-zinc-500">
          Nenhum cliente encontrado.
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Plano</th>
                <th className="text-left px-4 py-3">Integrações</th>
                <th className="text-right px-4 py-3">Bills</th>
                <th className="text-right px-4 py-3">Tickets abertos</th>
                <th className="text-right px-4 py-3">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {tenants?.map((t) => {
                const sub = t.subscription
                const owner = t.users.find((u) => u.role === "OWNER") ?? t.users[0]
                return (
                  <tr key={t.id} className="hover:bg-zinc-950 transition">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-100 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                        {t.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {owner ? `${owner.name} · ${owner.email}` : `${t._count.users} usuários`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {sub ? (
                        <div className="space-y-1">
                          <div className="font-mono text-xs text-zinc-300">{sub.plan}</div>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${STATUS_TONE[sub.status]}`}
                          >
                            {STATUS_LABEL[sub.status]}
                          </span>
                          {sub.value != null && (
                            <div className="text-xs text-zinc-500">{formatCurrency(sub.value)}/mês</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-xs">sem assinatura</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 ${
                            t._count.mlIntegrations > 0 ? "text-emerald-400" : "text-zinc-600"
                          }`}
                          title="Mercado Livre"
                        >
                          <Plug className="w-3 h-3" /> ML
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 ${
                            t.mpIntegration ? "text-emerald-400" : "text-zinc-600"
                          }`}
                          title="Mercado Pago"
                        >
                          <Plug className="w-3 h-3" /> MP
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <Receipt className="w-3.5 h-3.5" />
                        {t._count.bills}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t._count.tickets > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-400">
                          <TicketsIcon className="w-3.5 h-3.5" />
                          {t._count.tickets}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-zinc-500 whitespace-nowrap">
                      {formatDate(t.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function KPI({ label, value, accent = "default" }: { label: string; value: string; accent?: "default" | "emerald" | "blue" | "amber" | "primary" }) {
  const accentCls = {
    default: "text-zinc-100",
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    amber: "text-amber-400",
    primary: "text-primary-400",
  }[accent]
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accentCls}`}>{value}</p>
    </div>
  )
}
