"use client"

import { useEffect, useState } from "react"
import { formatCurrency } from "@/lib/calculations"
import { Loader, ChevronDown, ChevronRight, FolderTree } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"

interface Sub {
  id: string | null
  name: string
  total: number
  count: number
  pct: number
}
interface Item {
  id: string | null
  name: string
  total: number
  count: number
  pct: number
  subs: Sub[]
}
interface Response {
  month: string
  basis: "paid" | "due"
  total: number
  items: Item[]
}

function currentYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// Paleta de cores pra barra (ciclica)
const COLORS = [
  "bg-primary-500",
  "bg-fuchsia-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-lime-500",
]

export default function DespesasCategoriaPage() {
  const [month, setMonth] = useState(currentYM())
  const [basis, setBasis] = useState<"paid" | "due">("paid")
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    fetch(`/api/relatorios/despesas-categoria?month=${month}&basis=${basis}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false))
  }, [month, basis])

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="📂 Despesas por categoria"
        description="Distribuição das despesas operacionais no mês, agrupadas pela categoria cadastrada."
        actions={
          <div className="flex gap-2 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Base</label>
              <select
                value={basis}
                onChange={(e) => setBasis(e.target.value as "paid" | "due")}
                className="border border-gray-300 rounded-lg px-2 py-2 text-sm"
              >
                <option value="paid">Pagas no mês</option>
                <option value="due">Com vencimento no mês</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mês</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        }
      />

      {loading || !data ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-gray-500">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            Calculando...
          </CardContent>
        </Card>
      ) : data.items.length === 0 ? (
        <Card>
          <CardContent className="py-0">
            <EmptyState
              icon={FolderTree}
              title="Nenhuma despesa no período"
              description={
                basis === "paid"
                  ? "Nenhuma conta paga com paidDate no mês selecionado."
                  : "Nenhuma conta com vencimento no mês selecionado."
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">Total de despesas</p>
                  <p className="text-3xl font-bold text-rose-600">{formatCurrency(data.total)}</p>
                </div>
                <p className="text-xs text-gray-500">
                  {data.items.length} categoria{data.items.length === 1 ? "" : "s"}
                </p>
              </div>

              {/* Barra empilhada */}
              <div className="flex w-full h-4 rounded-full overflow-hidden bg-gray-100">
                {data.items.map((it, idx) => (
                  <div
                    key={it.id || it.name}
                    className={COLORS[idx % COLORS.length]}
                    style={{ width: `${it.pct}%` }}
                    title={`${it.name}: ${it.pct.toFixed(1)}%`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs">
                {data.items.map((it, idx) => (
                  <div key={it.id || it.name} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${COLORS[idx % COLORS.length]}`} />
                    <span className="text-gray-700">{it.name}</span>
                    <span className="text-gray-400">{it.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Categoria</th>
                    <th className="px-4 py-3 text-right">Contas</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3 text-left w-[40%]">% do total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((it, idx) => {
                    const key = it.id || it.name
                    const open = expanded.has(key)
                    const canExpand = it.subs.length > 0
                    return (
                      <>
                        <tr key={key} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => canExpand && toggle(key)}
                              className="flex items-center gap-1 font-medium text-gray-900"
                              disabled={!canExpand}
                            >
                              {canExpand ? (
                                open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                              ) : (
                                <span className="w-4 h-4 inline-block" />
                              )}
                              {it.name}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">{it.count}</td>
                          <td className="px-4 py-3 text-right font-semibold text-rose-600 whitespace-nowrap">
                            {formatCurrency(it.total)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${COLORS[idx % COLORS.length]}`}
                                  style={{ width: `${Math.min(it.pct, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 tabular-nums w-14 text-right">
                                {it.pct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                        {open &&
                          it.subs.map((sub) => (
                            <tr key={`${key}-${sub.id || sub.name}`} className="bg-gray-50/50">
                              <td className="px-4 py-2 pl-12 text-sm text-gray-700">{sub.name}</td>
                              <td className="px-4 py-2 text-right text-xs text-gray-500">{sub.count}</td>
                              <td className="px-4 py-2 text-right text-sm text-rose-500 whitespace-nowrap">
                                {formatCurrency(sub.total)}
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-500">{sub.pct.toFixed(1)}%</td>
                            </tr>
                          ))}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
