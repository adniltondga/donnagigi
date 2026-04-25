"use client"

import { useEffect, useState } from "react"
import { Loader, Download, TrendingUp, TrendingDown, Wallet } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { PeriodFilter, PeriodPreset, resolvePreset } from "@/components/admin/PeriodFilter"
import { formatCurrency } from "@/lib/calculations"

interface Linha {
  id: string
  date: string
  historico: string
  categoria: string
  supplier: string | null
  type: "receivable" | "payable"
  entrada: number
  saida: number
  saldo: number
}

interface LivroResponse {
  from: string
  to: string
  linhas: Linha[]
  resumo: {
    totalEntradas: number
    totalSaidas: number
    saldoPeriodo: number
    count: number
  }
}

export default function LivroCaixaPage() {
  const initial = resolvePreset("mes")
  const [from, setFrom] = useState<string>(initial.from)
  const [to, setTo] = useState<string>(initial.to)
  const [preset, setPreset] = useState<PeriodPreset>("mes")
  const [data, setData] = useState<LivroResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/relatorios/livro-caixa?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false))
  }, [from, to])

  const exportCSV = () => {
    if (!data) return
    const header = ["Data", "Histórico", "Categoria", "Fornecedor", "Entrada", "Saída", "Saldo"]
    const rows = data.linhas.map((l) => [
      l.date,
      l.historico.replace(/"/g, '""'),
      l.categoria,
      l.supplier || "",
      l.entrada.toFixed(2).replace(".", ","),
      l.saida.toFixed(2).replace(".", ","),
      l.saldo.toFixed(2).replace(".", ","),
    ])
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(";")).join("\n")
    // BOM pra Excel reconhecer UTF-8
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `livro-caixa-${from}-a-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="📘 Livro Caixa"
        description="Lançamentos cronológicos de entradas e saídas no período. Exporta em CSV pro contador."
        actions={
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data || data.linhas.length === 0}>
            <Download className="w-4 h-4 mr-1" />
            Exportar CSV
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-5">
          <PeriodFilter
            from={from}
            to={to}
            preset={preset}
            onChange={(n) => {
              setFrom(n.from)
              setTo(n.to)
              setPreset(n.preset)
            }}
          />
        </CardContent>
      </Card>

      {loading || !data ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            Carregando...
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard
              label="Entradas"
              value={formatCurrency(data.resumo.totalEntradas)}
              sub="recebimentos do período"
              icon={TrendingUp}
              accent="emerald"
            />
            <StatCard
              label="Saídas"
              value={formatCurrency(data.resumo.totalSaidas)}
              sub="pagamentos do período"
              icon={TrendingDown}
              accent="rose"
            />
            <StatCard
              label="Saldo do período"
              value={formatCurrency(data.resumo.saldoPeriodo)}
              sub={`${data.resumo.count} lançamento(s)`}
              icon={Wallet}
              accent={data.resumo.saldoPeriodo >= 0 ? "emerald" : "rose"}
            />
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Data</th>
                    <th className="px-4 py-3 text-left">Histórico</th>
                    <th className="px-4 py-3 text-left">Categoria</th>
                    <th className="px-4 py-3 text-right">Entrada</th>
                    <th className="px-4 py-3 text-right">Saída</th>
                    <th className="px-4 py-3 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.linhas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum lançamento no período.
                      </td>
                    </tr>
                  ) : (
                    data.linhas.map((l) => (
                      <tr key={l.id} className="hover:bg-accent">
                        <td className="px-4 py-2 whitespace-nowrap text-foreground">
                          {new Date(`${l.date}T12:00:00`).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-2 max-w-md">
                          <div className="truncate" title={l.historico}>
                            {l.historico}
                          </div>
                          {l.supplier && <div className="text-xs text-muted-foreground">{l.supplier}</div>}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{l.categoria}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-emerald-600 whitespace-nowrap">
                          {l.entrada > 0 ? formatCurrency(l.entrada) : ""}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-rose-600 whitespace-nowrap">
                          {l.saida > 0 ? formatCurrency(l.saida) : ""}
                        </td>
                        <td
                          className={`px-4 py-2 text-right tabular-nums font-medium whitespace-nowrap ${
                            l.saldo >= 0 ? "text-foreground" : "text-rose-600"
                          }`}
                        >
                          {formatCurrency(l.saldo)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {data.linhas.length > 0 && (
                  <tfoot className="bg-muted font-semibold text-foreground">
                    <tr>
                      <td className="px-4 py-3" colSpan={3}>
                        TOTAIS
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">
                        {formatCurrency(data.resumo.totalEntradas)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-rose-600">
                        {formatCurrency(data.resumo.totalSaidas)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums ${
                          data.resumo.saldoPeriodo >= 0 ? "text-foreground" : "text-rose-600"
                        }`}
                      >
                        {formatCurrency(data.resumo.saldoPeriodo)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
