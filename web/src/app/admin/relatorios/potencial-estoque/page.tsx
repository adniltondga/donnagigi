'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/calculations'
import { BarChart3, Package, TrendingUp, AlertTriangle, Loader, RefreshCw } from 'lucide-react'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { KpiCard } from '@/components/ui/kpi-card'
import type { PotencialItem } from '@/app/api/relatorios/potencial-estoque/route'

interface Summary {
  totalAnuncios: number
  totalUnidades: number
  totalBruto: number
  totalTaxaML: number
  totalLiquido: number
  totalCusto: number
  totalLucro: number
  ticketMedio: number
  margemMedia: number
  semCusto: number
  taxaPct: number
}

export default function PotencialEstoquePage() {
  const [lines, setLines] = useState<PotencialItem[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/relatorios/potencial-estoque')
      const data = await res.json()
      if (!res.ok) {
        setError(data.erro ?? 'Erro ao carregar dados')
        return
      }
      setLines(data.lines)
      setSummary(data.summary)
      setLastUpdated(new Date())
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const fmt = (n: number) => formatCurrency(n)
  const pct = (n: number | null) =>
    n != null ? `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` : '—'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Potencial de Estoque"
        description={`Se você vendesse tudo hoje — faturamento bruto, após taxas ML (${summary?.taxaPct ?? 18}% est.) e lucro real.`}
        actions={
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-border hover:bg-accent text-foreground font-medium px-3 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </button>
        }
      />

      {lastUpdated && (
        <p className="text-xs text-muted-foreground">
          Atualizado em {lastUpdated.toLocaleTimeString('pt-BR')} — dados em tempo real do Mercado Livre
        </p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {summary && (
        <>
          {summary.semCusto > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>{summary.semCusto} anúncio{summary.semCusto > 1 ? 's' : ''} sem custo cadastrado</strong> — lucro e margem parcialmente calculados.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard
              label="Anúncios ativos"
              value={String(summary.totalAnuncios)}
              sub={`${summary.totalUnidades} unidades`}
            />
            <KpiCard
              label="Faturamento bruto"
              value={fmt(summary.totalBruto)}
              sub="preço × estoque"
            />
            <KpiCard
              label="Taxa ML (est.)"
              value={fmt(summary.totalTaxaML)}
              sub={`${summary.taxaPct}% sobre bruto`}
              accent="amber"
            />
            <KpiCard
              label="Líquido (após taxas)"
              value={fmt(summary.totalLiquido)}
              sub="bruto − taxa ML"
            />
            <KpiCard
              label="Lucro potencial"
              value={fmt(summary.totalLucro)}
              sub={`margem ${pct(summary.margemMedia)}`}
              accent={summary.totalLucro > 0 ? "emerald" : "amber"}
            />
            <KpiCard
              label="Ticket médio"
              value={fmt(summary.ticketMedio)}
              sub="por unidade"
            />
          </div>
        </>
      )}

      {loading && !summary && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader className="w-5 h-5 animate-spin" />
          <span className="text-sm">Buscando anúncios no Mercado Livre…</span>
        </div>
      )}

      {!loading && lines.length === 0 && !error && summary && (
        <EmptyState icon={Package} title="Nenhum anúncio ativo com estoque encontrado" />
      )}

      {lines.length > 0 && (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-right">Preço unit.</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Taxa ML</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-right">Custo total</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead className="text-right">Margem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => {
                const hasCost = l.productCost != null
                const lucroPositivo = l.lucro != null && l.lucro > 0
                return (
                  <TableRow key={`${l.mlListingId}-${l.variationId ?? 'root'}`}>
                    <TableCell className="text-sm max-w-xs">
                      <div className="font-medium text-foreground truncate">{l.title}</div>
                      {l.variationName && (
                        <div className="text-xs text-muted-foreground mt-0.5">{l.variationName}</div>
                      )}
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{l.mlListingId}</div>
                    </TableCell>
                    <TableCell className="text-sm text-right font-semibold">
                      {l.qty}
                    </TableCell>
                    <TableCell className="text-sm text-right whitespace-nowrap">
                      {fmt(l.price)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-semibold whitespace-nowrap">
                      {fmt(l.bruto)}
                    </TableCell>
                    <TableCell className="text-sm text-right whitespace-nowrap text-amber-600">
                      {fmt(l.taxaML)}
                    </TableCell>
                    <TableCell className="text-sm text-right whitespace-nowrap text-foreground">
                      {fmt(l.liquido)}
                    </TableCell>
                    <TableCell className="text-sm text-right whitespace-nowrap">
                      {hasCost ? (
                        <span className="text-rose-600">{fmt(l.custoTotal!)}</span>
                      ) : (
                        <span className="text-muted-foreground/60 text-xs">sem custo</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-sm text-right font-semibold whitespace-nowrap ${
                        !hasCost
                          ? 'text-muted-foreground/60'
                          : lucroPositivo
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {l.lucro != null ? fmt(l.lucro) : '—'}
                    </TableCell>
                    <TableCell
                      className={`text-sm text-right whitespace-nowrap font-medium ${
                        !hasCost
                          ? 'text-muted-foreground/60'
                          : lucroPositivo
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {pct(l.margem)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Taxa ML estimada em {summary?.taxaPct ?? 18}% — varia por categoria. Valores reais podem diferir.</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Inclui apenas anúncios com status <strong>ativo</strong> e estoque &gt; 0 no Mercado Livre.</span>
        </div>
      </div>
    </div>
  )
}
