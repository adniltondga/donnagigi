"use client"

import { useEffect, useState } from "react"
import { formatCurrency } from "@/lib/calculations"
import { Trophy, Package, TrendingDown, TrendingUp } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import { ProductLabel } from "@/components/ProductLabel"

interface Item {
  listingId: string
  title: string
  variation: string | null
  vendas: number
  unidades: number
  totalBruto: number
  lucroEstimado: number | null
  ultimaVenda: string | null
}

type Direction = "mais" | "menos"

const COPY: Record<Direction, { title: string; description: string; icon: typeof Trophy; emoji: string }> = {
  mais: {
    title: "Ranking de produtos",
    description: "Ranking dos produtos (com variação) que mais vendem em unidades, considerando vendas não canceladas.",
    icon: Trophy,
    emoji: "🏆",
  },
  menos: {
    title: "Ranking de produtos",
    description: "Produtos que venderam menos unidades — útil pra identificar anúncios com baixa rotatividade.",
    icon: TrendingDown,
    emoji: "📉",
  },
}

export default function ProdutosRankingPage() {
  const [direction, setDirection] = useState<Direction>("mais")
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(50)
  const [loading, setLoading] = useState(true)
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({})

  useEffect(() => {
    setLoading(true)
    fetch(`/api/relatorios/top-produtos?direction=${direction}&limit=${limit}`)
      .then((r) => (r.ok ? r.json() : { items: [], total: 0 }))
      .then((d) => {
        setItems(d.items || [])
        setTotal(d.total || 0)
      })
      .finally(() => setLoading(false))
  }, [direction, limit])

  // Fire-and-forget: enriquece com thumbnails do ML.
  useEffect(() => {
    if (Object.keys(thumbs).length > 0) return
    fetch("/api/ml/all-listings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.items) return
        const map: Record<string, string | null> = {}
        for (const it of d.items as Array<{ mlListingId: string; thumbnail: string | null }>) {
          map[it.mlListingId] = it.thumbnail
        }
        setThumbs(map)
      })
      .catch(() => {})
  }, [thumbs])

  const copy = COPY[direction]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${copy.emoji} ${copy.title}`}
        description={copy.description}
        actions={
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
          >
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
            <option value={100}>Top 100</option>
            <option value={200}>Top 200</option>
          </select>
        }
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex bg-muted rounded-lg p-1">
          <button
            type="button"
            onClick={() => setDirection("mais")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition ${
              direction === "mais"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Mais vendidos
          </button>
          <button
            type="button"
            onClick={() => setDirection("menos")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition ${
              direction === "menos"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            Menos vendidos
          </button>
        </div>

        <div className="text-sm text-muted-foreground">
          {loading
            ? "Carregando..."
            : `${items.length} de ${total} produto${total === 1 ? "" : "s"} com venda`}
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <LoadingState variant="card" label="Calculando ranking..." />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Nenhuma venda encontrada"
            description="Sincronize pedidos do ML primeiro."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left w-12">#</th>
                  <th className="px-4 py-3 text-left">Produto</th>
                  <th className="px-4 py-3 text-right">Unidades</th>
                  <th className="px-4 py-3 text-right">Pedidos</th>
                  <th className="px-4 py-3 text-right">Bruto</th>
                  <th className="px-4 py-3 text-right">Lucro*</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Última venda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it, idx) => {
                  const rankColor =
                    idx === 0
                      ? "text-amber-600"
                      : idx === 1
                      ? "text-muted-foreground"
                      : idx === 2
                      ? "text-orange-700"
                      : "text-muted-foreground"
                  const thumb = thumbs[it.listingId]
                  return (
                    <tr key={`${it.listingId}-${it.variation || ""}`} className="hover:bg-accent">
                      <td className={`px-4 py-3 font-bold text-center ${rankColor}`}>{idx + 1}</td>
                      <td className="px-4 py-3 max-w-md">
                        <div className="flex items-start gap-3 min-w-0">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt=""
                              loading="lazy"
                              className="w-12 h-12 rounded-lg object-cover border border-border bg-muted shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg border border-border bg-muted flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-muted-foreground/60" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <ProductLabel
                              title={it.title}
                              variation={it.variation}
                              mlListingId={it.listingId}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        {it.unidades}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{it.vendas}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                        {formatCurrency(it.totalBruto)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                          it.lucroEstimado == null
                            ? "text-muted-foreground"
                            : it.lucroEstimado >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {it.lucroEstimado == null ? "—" : formatCurrency(it.lucroEstimado)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {it.ultimaVenda
                          ? new Date(it.ultimaVenda).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        * Lucro = bruto − custo de mercadoria (só quando há custo cadastrado nas vendas
        consideradas). Cadastre os custos em <strong>Custos ML</strong> pra enriquecer o ranking.
      </p>
    </div>
  )
}
