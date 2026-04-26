"use client"

import { useEffect, useState } from "react"
import { Wallet, ShoppingBag, PiggyBank, Settings as SettingsIcon } from "lucide-react"
import { formatCurrency } from "@/lib/calculations"
import { LoadingState } from "@/components/ui/loading-state"

interface CashPools {
  reposicaoPct: number
  vendasLiquidas: number
  alocadoReposicao: number
  gastoReposicao: number
  caixaReposicao: number
  caixaReserva: number
}

interface DreApiResponse {
  current?: { lucroLiquido?: number }
}

function buildDreUrl(): string {
  const now = new Date()
  return `/api/relatorios/dre?year=${now.getFullYear()}&month=${now.getMonth() + 1}&basis=caixa`
}

/**
 * Card com as 3 caixas virtuais: Operacional, Reposição, Reserva.
 *
 * Se `lucroLiquido` for passado, usa direto. Senão, busca via
 * /api/relatorios/dre do mês corrente — assim o componente é
 * auto-suficiente e pode ser usado em qualquer página.
 */
export function CashPoolsCard({ lucroLiquido }: { lucroLiquido?: number }) {
  const [data, setData] = useState<CashPools | null>(null)
  const [lucroFetched, setLucroFetched] = useState<number | undefined>(lucroLiquido)
  const [loading, setLoading] = useState(true)
  const [editingPct, setEditingPct] = useState(false)
  const [pctInput, setPctInput] = useState("50")
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const tasks: Promise<unknown>[] = [
        fetch("/api/financeiro/cash-pools")
          .then((r) => (r.ok ? r.json() : null))
          .then((d: CashPools | null) => {
            if (d) {
              setData(d)
              setPctInput(String(d.reposicaoPct))
            }
          }),
      ]
      if (lucroLiquido === undefined) {
        tasks.push(
          fetch(buildDreUrl())
            .then((r) => (r.ok ? r.json() : null))
            .then((d: DreApiResponse | null) => {
              if (d?.current?.lucroLiquido !== undefined) {
                setLucroFetched(d.current.lucroLiquido)
              }
            }),
        )
      }
      await Promise.all(tasks)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const savePct = async () => {
    setSaving(true)
    try {
      const n = Number(pctInput)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setSaving(false)
        return
      }
      await fetch("/api/financial-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reposicaoPct: n }),
      })
      setEditingPct(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="bg-card border border-border rounded-xl">
        <LoadingState variant="inline" size="sm" label="Carregando caixas..." />
      </div>
    )
  }

  const operacional = lucroLiquido ?? lucroFetched ?? 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <PoolCard
          icon={<Wallet />}
          label="Caixa Operacional"
          value={operacional}
          desc="lucro líquido do mês — disponível pro dia-a-dia"
          color="emerald"
        />
        <PoolCard
          icon={<ShoppingBag />}
          label="Caixa de Reposição"
          value={data.caixaReposicao}
          desc={`${data.reposicaoPct}% das vendas líquidas reservadas pra repor estoque`}
          color="amber"
        />
        <PoolCard
          icon={<PiggyBank />}
          label="Caixa de Reserva"
          value={data.caixaReserva}
          desc="colchão de segurança (saldo manual)"
          color="primary"
        />
      </div>

      {/* Detalhes da reposição */}
      <details className="bg-muted/40 rounded-lg px-4 py-3 text-sm">
        <summary className="cursor-pointer flex items-center gap-2 text-foreground font-medium">
          <SettingsIcon size={14} />
          Como o Caixa de Reposição é calculado
        </summary>
        <div className="mt-3 space-y-2 text-muted-foreground">
          <div className="grid grid-cols-2 gap-2">
            <span>Vendas líquidas no mês:</span>
            <span className="text-right text-foreground font-mono">
              {formatCurrency(data.vendasLiquidas)}
            </span>
            <span>× {data.reposicaoPct}% reservado pra reposição:</span>
            <span className="text-right text-foreground font-mono">
              {formatCurrency(data.alocadoReposicao)}
            </span>
            <span>− Compras de estoque já feitas:</span>
            <span className="text-right text-foreground font-mono">
              {formatCurrency(data.gastoReposicao)}
            </span>
            <span className="font-semibold text-foreground border-t border-border pt-1">
              = Saldo da Caixa de Reposição:
            </span>
            <span className="text-right font-mono font-semibold text-foreground border-t border-border pt-1">
              {formatCurrency(data.caixaReposicao)}
            </span>
          </div>

          <div className="pt-3 border-t border-border">
            {editingPct ? (
              <div className="flex items-center gap-2">
                <span>Ajustar %:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={pctInput}
                  onChange={(e) => setPctInput(e.target.value)}
                  className="w-16 px-2 py-1 border border-border rounded outline-none focus:ring-2 focus:ring-primary-600 text-sm"
                />
                <span>%</span>
                <button
                  onClick={savePct}
                  disabled={saving}
                  className="px-2 py-1 rounded bg-primary-600 hover:bg-primary-700 text-white text-xs disabled:opacity-50"
                >
                  Salvar
                </button>
                <button
                  onClick={() => {
                    setEditingPct(false)
                    setPctInput(String(data.reposicaoPct))
                  }}
                  className="px-2 py-1 rounded text-xs text-muted-foreground"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingPct(true)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Ajustar % de reposição
              </button>
            )}
          </div>
        </div>
      </details>
    </div>
  )
}

const COLORS: Record<string, { bg: string; text: string; iconBg: string }> = {
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", iconBg: "bg-emerald-100 dark:bg-emerald-900/40" },
  amber: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", iconBg: "bg-amber-100 dark:bg-amber-900/40" },
  primary: { bg: "bg-primary-50 dark:bg-primary-950/30", text: "text-primary-700 dark:text-primary-400", iconBg: "bg-primary-100 dark:bg-primary-900/40" },
}

function PoolCard({
  icon,
  label,
  value,
  desc,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  desc: string
  color: keyof typeof COLORS
}) {
  const c = COLORS[color]
  return (
    <div className={`${c.bg} rounded-xl p-4 border border-border/40`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 ${c.iconBg} ${c.text} rounded-lg flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className={`text-xl font-bold mt-1 ${c.text}`}>{formatCurrency(value)}</p>
          <p className="text-xs text-muted-foreground mt-1">{desc}</p>
        </div>
      </div>
    </div>
  )
}
