"use client"

import { useEffect, useState } from "react"
import { formatCurrency } from "@/lib/calculations"
import { Trophy, Loader } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
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

export function TopProdutosTable({
  direction,
  title,
  description,
}: {
  direction: "mais" | "menos"
  title: string
  description: string
}) {
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(50)
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
          >
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
            <option value={100}>Top 100</option>
            <option value={200}>Top 200</option>
          </select>
        }
      />

      <div className="text-sm text-gray-600">
        {loading
          ? "Carregando..."
          : `${items.length} de ${total} produto${total === 1 ? "" : "s"} com venda`}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            Calculando ranking...
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Nenhuma venda encontrada"
            description="Sincronize pedidos do ML primeiro."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left w-12">#</th>
                  <th className="px-4 py-3 text-left">Produto</th>
                  <th className="px-4 py-3 text-left">MLB</th>
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
                      ? "text-gray-500"
                      : idx === 2
                      ? "text-orange-700"
                      : "text-gray-400"
                  return (
                    <tr key={`${it.listingId}-${it.variation || ""}`} className="hover:bg-gray-50">
                      <td className={`px-4 py-3 font-bold text-center ${rankColor}`}>{idx + 1}</td>
                      <td className="px-4 py-3 max-w-md">
                        <ProductLabel title={it.title} variation={it.variation} hideMlb />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                        {it.listingId}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {it.unidades}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{it.vendas}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {formatCurrency(it.totalBruto)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                          it.lucroEstimado == null
                            ? "text-gray-400"
                            : it.lucroEstimado >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {it.lucroEstimado == null ? "—" : formatCurrency(it.lucroEstimado)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
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

      <p className="text-xs text-gray-500">
        * Lucro = bruto − custo de mercadoria (só quando há custo cadastrado nas vendas
        consideradas). Cadastre os custos em <strong>Custos ML</strong> pra enriquecer o ranking.
      </p>
    </div>
  )
}
