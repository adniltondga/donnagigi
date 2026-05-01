"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Wallet, ShoppingBag, PiggyBank, Settings as SettingsIcon, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/lib/calculations"
import { LoadingState } from "@/components/ui/loading-state"

interface CashPools {
  vendasLiquidas: number
  cmv: number
  vendasSemCusto: number
  vendasTotais: number
  alocadoReposicao: number
  gastoReposicao: number
  caixaReposicao: number
  caixaReserva: number
}

interface DreApiResponse {
  current?: { lucroLiquido?: number }
}

function buildDreUrl(startStr?: string): string {
  let y: number
  let m: number
  if (startStr) {
    const [yy, mm] = startStr.split("-").map(Number)
    y = yy
    m = mm
  } else {
    const now = new Date()
    y = now.getFullYear()
    m = now.getMonth() + 1
  }
  return `/api/relatorios/dre?year=${y}&month=${m}&basis=caixa`
}

/**
 * Card com as 3 caixas virtuais: Operacional, Reposição, Reserva.
 *
 * Props (todos opcionais):
 *  - `start`/`end` (YYYY-MM-DD): limita período. Default: mês corrente.
 *  - `lucroLiquido`: se passado, usa direto e não busca DRE.
 *
 * Quando o período cobre múltiplos meses, o Lucro Operacional usa o
 * mês de início do período (DRE é sempre por mês).
 */
export function CashPoolsCard({
  lucroLiquido,
  start,
  end,
}: {
  lucroLiquido?: number
  start?: string
  end?: string
}) {
  const [data, setData] = useState<CashPools | null>(null)
  const [lucroFetched, setLucroFetched] = useState<number | undefined>(lucroLiquido)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const cashUrl = new URL("/api/financeiro/cash-pools", window.location.origin)
      if (start) cashUrl.searchParams.set("start", start)
      if (end) cashUrl.searchParams.set("end", end)
      const tasks: Promise<unknown>[] = [
        fetch(cashUrl.toString())
          .then((r) => (r.ok ? r.json() : null))
          .then((d: CashPools | null) => {
            if (d) setData(d)
          }),
      ]
      if (lucroLiquido === undefined) {
        tasks.push(
          fetch(buildDreUrl(start))
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
  }, [start, end])

  if (loading || !data) {
    return (
      <div className="bg-card border border-border rounded-xl">
        <LoadingState variant="inline" size="sm" label="Carregando caixas..." />
      </div>
    )
  }

  const operacional = lucroLiquido ?? lucroFetched ?? 0
  const temVendasSemCusto = data.vendasSemCusto > 0

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
          desc="custo das mercadorias vendidas — reservado pra repor estoque"
          color="amber"
          warning={temVendasSemCusto}
        />
        <PoolCard
          icon={<PiggyBank />}
          label="Caixa de Reserva"
          value={data.caixaReserva}
          desc="colchão de segurança (saldo manual)"
          color="primary"
        />
      </div>

      {temVendasSemCusto && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>{data.vendasSemCusto} de {data.vendasTotais} vendas sem custo cadastrado</strong> — a Caixa de Reposição está subestimada.{" "}
            <Link href="/admin/produtos/anuncios" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200">
              Cadastrar custos
            </Link>
            .
          </div>
        </div>
      )}

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
            <span>CMV (custo das mercadorias vendidas):</span>
            <span className="text-right text-foreground font-mono">
              {formatCurrency(data.cmv)}
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
          <p className="text-xs pt-2 border-t border-border">
            A caixa reserva o valor do CMV (custo total das mercadorias vendidas) pra
            cobrir a reposição do estoque. Vendas sem custo cadastrado ficam de fora —
            cadastre o custo dos anúncios pra deixar a conta completa.
          </p>
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
  warning,
}: {
  icon: React.ReactNode
  label: string
  value: number
  desc: string
  color: keyof typeof COLORS
  warning?: boolean
}) {
  const c = COLORS[color]
  return (
    <div className={`${c.bg} rounded-xl p-4 border border-border/40 relative`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 ${c.iconBg} ${c.text} rounded-lg flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            {label}
            {warning && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />}
          </p>
          <p className={`text-xl font-bold mt-1 ${c.text}`}>{formatCurrency(value)}</p>
          <p className="text-xs text-muted-foreground mt-1">{desc}</p>
        </div>
      </div>
    </div>
  )
}
