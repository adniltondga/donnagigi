"use client"

import { useEffect, useState } from "react"
import { formatCurrency } from "@/lib/calculations"
import { TrendingUp, TrendingDown, Minus, Loader } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DreResult {
  receitaBrutaML: number
  receitaBrutaOutras: number
  receitaBruta: number
  taxaVendaML: number
  taxaEnvioML: number
  totalTaxas: number
  receitaLiquida: number
  cmv: number
  lucroBruto: number
  despesasPorCategoria: Array<{ name: string; total: number }>
  totalDespesas: number
  lucroLiquido: number
  margemLiquidaPct: number
}

interface Response {
  month: string
  previousMonth: string
  current: DreResult
  previous: DreResult
}

function currentMonthYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-")
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
}

export default function DrePage() {
  const [month, setMonth] = useState(currentMonthYM())
  const [basis, setBasis] = useState<"caixa" | "competencia">("competencia")
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/relatorios/dre?month=${month}&basis=${basis}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false))
  }, [month, basis])

  return (
    <div className="space-y-6">
      <PageHeader
        title="📊 DRE mensal"
        description={
          basis === "caixa"
            ? "Regime de caixa: só o que efetivamente entrou/saiu (pago/recebido no período)."
            : "Regime de competência: tudo que vence no mês, independente de já ter sido pago."
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              {([
                { key: "competencia", label: "Competência" },
                { key: "caixa", label: "Caixa" },
              ] as const).map((opt) => {
                const active = basis === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => setBasis(opt.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 outline-none"
            />
          </div>
        }
      />

      {loading || !data ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            Calculando...
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              label="Receita Bruta"
              current={data.current.receitaBruta}
              previous={data.previous.receitaBruta}
              format="currency"
            />
            <KpiCard
              label="Lucro Líquido"
              current={data.current.lucroLiquido}
              previous={data.previous.lucroLiquido}
              format="currency"
              highlight
            />
            <KpiCard
              label="Margem Líquida"
              current={data.current.margemLiquidaPct}
              previous={data.previous.margemLiquidaPct}
              format="percent"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resultado — {formatMonthLabel(data.month)}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DreTable current={data.current} previous={data.previous} />
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Comparativo vs <strong>{formatMonthLabel(data.previousMonth)}</strong>. Despesas operacionais
            agrupadas pela categoria-raiz cadastrada na aba Categorias do Financeiro.
          </p>
        </>
      )}
    </div>
  )
}

function KpiCard({
  label,
  current,
  previous,
  format,
  highlight,
}: {
  label: string
  current: number
  previous: number
  format: "currency" | "percent"
  highlight?: boolean
}) {
  const delta = current - previous
  const deltaPct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null
  const positive = delta > 0
  const negative = delta < 0
  const value = format === "currency" ? formatCurrency(current) : `${current.toFixed(1)}%`

  return (
    <Card className={highlight ? "border-primary-200 bg-primary-50/30" : ""}>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p
          className={`text-2xl font-bold ${
            highlight
              ? current >= 0
                ? "text-emerald-600"
                : "text-red-600"
              : "text-foreground"
          }`}
        >
          {value}
        </p>
        <div className="flex items-center gap-1 text-xs mt-1">
          {positive && <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
          {negative && <TrendingDown className="w-3.5 h-3.5 text-red-600" />}
          {!positive && !negative && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className={positive ? "text-emerald-600" : negative ? "text-red-600" : "text-muted-foreground"}>
            {deltaPct == null
              ? "—"
              : `${positive ? "+" : ""}${deltaPct.toFixed(1)}% vs mês anterior`}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function DreTable({ current, previous }: { current: DreResult; previous: DreResult }) {
  const rb = current.receitaBruta || 1 // evita div/0 pra %

  const rows: Array<
    | { kind: "section"; label: string; value: number; previous: number; indent?: number; sign?: "+" | "-"; emphasis?: boolean; neutral?: boolean }
    | { kind: "break" }
  > = [
    { kind: "section", label: "Receita Bruta ML (vendas)", value: current.receitaBrutaML, previous: previous.receitaBrutaML, indent: 1, neutral: true },
    { kind: "section", label: "+ Outras receitas", value: current.receitaBrutaOutras, previous: previous.receitaBrutaOutras, indent: 1, neutral: true },
    { kind: "section", label: "= Receita Bruta total", value: current.receitaBruta, previous: previous.receitaBruta, emphasis: true },
    { kind: "break" },
    { kind: "section", label: "(−) Taxa de venda ML", value: current.taxaVendaML, previous: previous.taxaVendaML, indent: 1, sign: "-" },
    { kind: "section", label: "(−) Taxa de envio ML", value: current.taxaEnvioML, previous: previous.taxaEnvioML, indent: 1, sign: "-" },
    { kind: "section", label: "= Receita Líquida", value: current.receitaLiquida, previous: previous.receitaLiquida, emphasis: true },
    { kind: "break" },
    { kind: "section", label: "(−) CMV (custo da mercadoria)", value: current.cmv, previous: previous.cmv, indent: 1, sign: "-" },
    { kind: "section", label: "= Lucro Bruto", value: current.lucroBruto, previous: previous.lucroBruto, emphasis: true },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Conta</th>
            <th className="px-4 py-3 text-right">Mês atual</th>
            <th className="px-4 py-3 text-right">% da receita</th>
            <th className="px-4 py-3 text-right">Mês anterior</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.kind === "break") {
              return (
                <tr key={`br-${i}`}>
                  <td colSpan={4} className="py-1"></td>
                </tr>
              )
            }
            const pct = rb > 0 ? (row.value / current.receitaBruta) * 100 : 0
            return (
              <tr
                key={i}
                className={row.emphasis ? "bg-muted font-semibold border-t border-b border-border" : ""}
              >
                <td
                  className={`px-4 py-2 ${row.indent ? "pl-10" : ""} ${row.emphasis ? "text-foreground" : "text-foreground"}`}
                >
                  {row.label}
                </td>
                <td
                  className={`px-4 py-2 text-right whitespace-nowrap ${
                    row.sign === "-" ? "text-rose-600" : row.emphasis ? "text-foreground" : "text-foreground"
                  }`}
                >
                  {formatCurrency(row.value)}
                </td>
                <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                  {current.receitaBruta > 0 ? `${pct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                  {formatCurrency(row.previous)}
                </td>
              </tr>
            )
          })}

          {/* Despesas por categoria, agrupadas */}
          <tr>
            <td colSpan={4} className="px-4 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Despesas operacionais (pagas no mês)
            </td>
          </tr>
          {current.despesasPorCategoria.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-2 text-sm text-muted-foreground italic pl-10">
                Nenhuma despesa no mês
              </td>
            </tr>
          ) : (
            current.despesasPorCategoria.map((cat) => {
              const pct = current.receitaBruta > 0 ? (cat.total / current.receitaBruta) * 100 : 0
              const prevCat = previous.despesasPorCategoria.find((p) => p.name === cat.name)
              return (
                <tr key={cat.name}>
                  <td className="px-4 py-2 pl-10 text-foreground">(−) {cat.name}</td>
                  <td className="px-4 py-2 text-right text-rose-600 whitespace-nowrap">{formatCurrency(cat.total)}</td>
                  <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                    {current.receitaBruta > 0 ? `${pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                    {prevCat ? formatCurrency(prevCat.total) : "—"}
                  </td>
                </tr>
              )
            })
          )}
          <tr className="bg-muted font-semibold border-t border-b border-border">
            <td className="px-4 py-2">= Total despesas</td>
            <td className="px-4 py-2 text-right text-rose-600 whitespace-nowrap">
              {formatCurrency(current.totalDespesas)}
            </td>
            <td className="px-4 py-2 text-right text-xs text-muted-foreground">
              {current.receitaBruta > 0
                ? `${((current.totalDespesas / current.receitaBruta) * 100).toFixed(1)}%`
                : "—"}
            </td>
            <td className="px-4 py-2 text-right text-xs text-muted-foreground">
              {formatCurrency(previous.totalDespesas)}
            </td>
          </tr>

          <tr>
            <td colSpan={4} className="py-1"></td>
          </tr>

          <tr
            className={`font-bold text-base border-t-2 ${
              current.lucroLiquido >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
            }`}
          >
            <td className="px-4 py-3 text-foreground">= Lucro Líquido</td>
            <td
              className={`px-4 py-3 text-right whitespace-nowrap ${
                current.lucroLiquido >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {formatCurrency(current.lucroLiquido)}
            </td>
            <td className="px-4 py-3 text-right text-xs text-muted-foreground">
              {current.margemLiquidaPct.toFixed(1)}%
            </td>
            <td className="px-4 py-3 text-right text-xs text-muted-foreground">
              {formatCurrency(previous.lucroLiquido)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
