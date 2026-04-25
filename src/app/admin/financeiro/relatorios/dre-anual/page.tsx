"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader, Download } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/calculations"

interface DespesaCategoria {
  name: string
  total: number
}

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
  despesasPorCategoria: DespesaCategoria[]
  totalDespesas: number
  lucroLiquido: number
  margemLiquidaPct: number
}

interface DreAnualResponse {
  year: number
  basis: "caixa" | "competencia"
  availableYears: number[]
  months: Array<{ month: number; dre: DreResult }>
  total: DreResult
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

export default function DreAnualPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [basis, setBasis] = useState<"caixa" | "competencia">("competencia")
  const [data, setData] = useState<DreAnualResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/relatorios/dre-anual?year=${year}&basis=${basis}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false))
  }, [year, basis])

  const allCategories = useMemo(() => {
    if (!data) return [] as string[]
    const set = new Set<string>()
    for (const m of data.months) for (const c of m.dre.despesasPorCategoria) set.add(c.name)
    return Array.from(set).sort((a, b) => {
      const totA = data.total.despesasPorCategoria.find((x) => x.name === a)?.total ?? 0
      const totB = data.total.despesasPorCategoria.find((x) => x.name === b)?.total ?? 0
      return totB - totA
    })
  }, [data])

  const getCategoryForMonth = (monthIdx: number, catName: string): number => {
    if (!data) return 0
    return data.months[monthIdx].dre.despesasPorCategoria.find((c) => c.name === catName)?.total ?? 0
  }

  const exportCSV = () => {
    if (!data) return
    const header = ["Conta", ...MONTH_LABELS, "Total"]
    const lines: string[][] = [header]
    const row = (label: string, get: (i: number) => number, tot: number) => {
      lines.push([
        label,
        ...Array.from({ length: 12 }, (_, i) => get(i).toFixed(2).replace(".", ",")),
        tot.toFixed(2).replace(".", ","),
      ])
    }
    row("Receita Bruta ML", (i) => data.months[i].dre.receitaBrutaML, data.total.receitaBrutaML)
    row("Outras receitas", (i) => data.months[i].dre.receitaBrutaOutras, data.total.receitaBrutaOutras)
    row("Receita Bruta total", (i) => data.months[i].dre.receitaBruta, data.total.receitaBruta)
    row("(-) Taxa de venda ML", (i) => data.months[i].dre.taxaVendaML, data.total.taxaVendaML)
    row("(-) Taxa de envio ML", (i) => data.months[i].dre.taxaEnvioML, data.total.taxaEnvioML)
    row("Receita Líquida", (i) => data.months[i].dre.receitaLiquida, data.total.receitaLiquida)
    row("(-) CMV", (i) => data.months[i].dre.cmv, data.total.cmv)
    row("Lucro Bruto", (i) => data.months[i].dre.lucroBruto, data.total.lucroBruto)
    for (const cat of allCategories) {
      row(
        `(-) ${cat}`,
        (i) => getCategoryForMonth(i, cat),
        data.total.despesasPorCategoria.find((c) => c.name === cat)?.total ?? 0,
      )
    }
    row("Total despesas", (i) => data.months[i].dre.totalDespesas, data.total.totalDespesas)
    row("Lucro Líquido", (i) => data.months[i].dre.lucroLiquido, data.total.lucroLiquido)

    const csv = lines.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `dre-anual-${year}-${basis}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="📊 DRE anual"
        description={
          basis === "caixa"
            ? "Regime de caixa: só o que entrou/saiu de fato em cada mês."
            : "Regime de competência: tudo que vence no mês, pago ou não."
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
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
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 outline-none"
            >
              {(data?.availableYears ?? [year]).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data}>
              <Download className="w-4 h-4 mr-1" />
              CSV
            </Button>
          </div>
        }
      />

      {loading || !data ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            Calculando 12 meses...
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs min-w-full">
              <thead className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="sticky left-0 bg-muted z-10 px-3 py-2 text-left border-r border-border min-w-[200px]">
                    Conta
                  </th>
                  {MONTH_LABELS.map((m) => (
                    <th key={m} className="px-3 py-2 text-right whitespace-nowrap min-w-[90px]">
                      {m}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right whitespace-nowrap bg-muted min-w-[110px] border-l-2 border-border">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <Row
                  label="Receita Bruta ML"
                  getValue={(i) => data.months[i].dre.receitaBrutaML}
                  total={data.total.receitaBrutaML}
                  indent
                />
                <Row
                  label="+ Outras receitas"
                  getValue={(i) => data.months[i].dre.receitaBrutaOutras}
                  total={data.total.receitaBrutaOutras}
                  indent
                />
                <Row
                  label="= Receita Bruta"
                  getValue={(i) => data.months[i].dre.receitaBruta}
                  total={data.total.receitaBruta}
                  emphasis
                />
                <BreakRow />
                <Row
                  label="(−) Taxa de venda ML"
                  getValue={(i) => data.months[i].dre.taxaVendaML}
                  total={data.total.taxaVendaML}
                  indent
                  negative
                />
                <Row
                  label="(−) Taxa de envio ML"
                  getValue={(i) => data.months[i].dre.taxaEnvioML}
                  total={data.total.taxaEnvioML}
                  indent
                  negative
                />
                <Row
                  label="= Receita Líquida"
                  getValue={(i) => data.months[i].dre.receitaLiquida}
                  total={data.total.receitaLiquida}
                  emphasis
                />
                <BreakRow />
                <Row
                  label="(−) CMV"
                  getValue={(i) => data.months[i].dre.cmv}
                  total={data.total.cmv}
                  indent
                  negative
                />
                <Row
                  label="= Lucro Bruto"
                  getValue={(i) => data.months[i].dre.lucroBruto}
                  total={data.total.lucroBruto}
                  emphasis
                />
                <BreakRow />
                <tr>
                  <td
                    colSpan={14}
                    className="sticky left-0 bg-card px-3 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    Despesas operacionais
                  </td>
                </tr>
                {allCategories.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="sticky left-0 bg-card px-3 py-2 text-muted-foreground italic pl-8">
                      Nenhuma despesa no ano
                    </td>
                  </tr>
                ) : (
                  allCategories.map((cat) => (
                    <Row
                      key={cat}
                      label={`(−) ${cat}`}
                      getValue={(i) => getCategoryForMonth(i, cat)}
                      total={data.total.despesasPorCategoria.find((c) => c.name === cat)?.total ?? 0}
                      indent
                      negative
                    />
                  ))
                )}
                <Row
                  label="= Total despesas"
                  getValue={(i) => data.months[i].dre.totalDespesas}
                  total={data.total.totalDespesas}
                  emphasis
                  negative
                />
                <BreakRow />
                <Row
                  label="= Lucro Líquido"
                  getValue={(i) => data.months[i].dre.lucroLiquido}
                  total={data.total.lucroLiquido}
                  highlight
                />
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Total = soma dos 12 meses do ano selecionado. Meses sem lançamentos aparecem zerados. Clique em
        Exportar CSV pra abrir no Excel (separador <code>;</code>, UTF-8).
      </p>
    </div>
  )
}

function BreakRow() {
  return (
    <tr>
      <td colSpan={14} className="py-1"></td>
    </tr>
  )
}

function Row({
  label,
  getValue,
  total,
  indent,
  emphasis,
  negative,
  highlight,
}: {
  label: string
  getValue: (monthIdx: number) => number
  total: number
  indent?: boolean
  emphasis?: boolean
  negative?: boolean
  highlight?: boolean
}) {
  const rowClass = highlight
    ? total >= 0
      ? "bg-emerald-50 font-bold border-t-2 border-emerald-200"
      : "bg-rose-50 font-bold border-t-2 border-rose-200"
    : emphasis
    ? "bg-muted font-semibold border-t border-b border-border"
    : ""

  const cellBase = highlight
    ? total >= 0
      ? "text-emerald-700"
      : "text-red-600"
    : negative
    ? "text-rose-600"
    : emphasis
    ? "text-foreground"
    : "text-foreground"

  return (
    <tr className={rowClass}>
      <td
        className={`sticky left-0 z-10 px-3 py-1.5 border-r border-border whitespace-nowrap ${
          indent ? "pl-8" : ""
        } ${rowClass || "bg-card"} ${emphasis || highlight ? "text-foreground" : "text-foreground"}`}
      >
        {label}
      </td>
      {Array.from({ length: 12 }, (_, i) => {
        const v = getValue(i)
        return (
          <td
            key={i}
            className={`px-3 py-1.5 text-right tabular-nums whitespace-nowrap ${cellBase} ${
              v === 0 ? "text-muted-foreground/60" : ""
            }`}
          >
            {v === 0 ? "—" : formatCurrency(v)}
          </td>
        )
      })}
      <td
        className={`px-3 py-1.5 text-right tabular-nums whitespace-nowrap bg-muted border-l-2 border-border font-semibold ${cellBase}`}
      >
        {total === 0 ? "—" : formatCurrency(total)}
      </td>
    </tr>
  )
}
