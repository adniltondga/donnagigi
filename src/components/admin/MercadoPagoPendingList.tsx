"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Clock,
  ChevronDown,
  ChevronRight,
  Loader,
  AlertCircle,
  RefreshCw,
  Calendar,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/calculations"

interface Payment {
  id: number
  description: string
  releaseDate: string
  dateCreated: string | null
  netAmount: number
  grossAmount: number
  paymentMethodId: string | null
  externalReference: string | null
  buyer: string | null
}
interface Day {
  date: string
  total: number
  count: number
  payments: Payment[]
}
interface Response {
  configured: boolean
  total?: number
  count?: number
  days?: Day[]
  lastUpdated?: string
  error?: string
}

function formatDayLabel(isoDate: string): string {
  // isoDate é "YYYY-MM-DD" já no fuso BR
  const [y, m, d] = isoDate.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000)
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "long" })
  const full = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
  const relative =
    diffDays === 0
      ? "hoje"
      : diffDays === 1
      ? "amanhã"
      : diffDays < 0
      ? `há ${-diffDays} dia${-diffDays === 1 ? "" : "s"}`
      : `em ${diffDays} dias`
  return `${full} · ${weekday} · ${relative}`
}

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  master: "Mastercard",
  visa: "Visa",
  elo: "Elo",
  amex: "Amex",
  hipercard: "Hipercard",
  bolbradesco: "Boleto",
  account_money: "Saldo MP",
}

export function MercadoPagoPendingList() {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/mp/pending-payments")
      const d = await res.json()
      setData(d)
    } catch {
      setData({ configured: true, error: "Erro de conexão" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-gray-500">
          <Loader className="w-5 h-5 animate-spin mr-2" />
          Carregando pagamentos...
        </CardContent>
      </Card>
    )
  }

  if (!data.configured) {
    return null // card de topo já mostra o CTA de conectar
  }

  if (data.error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-5 flex items-center gap-2 text-sm text-red-800">
          <AlertCircle className="w-4 h-4" />
          {data.error}
          <Button variant="outline" size="sm" className="ml-auto" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    )
  }

  const days = data.days || []
  if (days.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center text-gray-500 text-sm">
          <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          Nenhum pagamento pendente de liberação no Mercado Pago.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="w-4 h-4 text-sky-600" />
          Liberações programadas · Mercado Pago
        </CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-gray-100">
          {days.map((day) => {
            const open = expanded.has(day.date)
            return (
              <li key={day.date}>
                <button
                  onClick={() => toggle(day.date)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-left"
                >
                  {open ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                  <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {formatDayLabel(day.date)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {day.count} pagamento{day.count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-emerald-600 tabular-nums whitespace-nowrap">
                    {formatCurrency(day.total)}
                  </div>
                </button>
                {open && (
                  <ul className="bg-gray-50 divide-y divide-gray-100 border-t border-gray-100">
                    {day.payments.map((p) => {
                      const method = p.paymentMethodId
                        ? METHOD_LABELS[p.paymentMethodId] || p.paymentMethodId
                        : null
                      return (
                        <li key={p.id} className="px-12 py-2.5 flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 line-clamp-1">
                              {p.description}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                              <span className="font-mono">#{p.id}</span>
                              {method && (
                                <>
                                  <span className="text-gray-300">·</span>
                                  <span>{method}</span>
                                </>
                              )}
                              {p.buyer && (
                                <>
                                  <span className="text-gray-300">·</span>
                                  <span>{p.buyer}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <div className="text-sm font-semibold text-emerald-600 tabular-nums">
                              {formatCurrency(p.netAmount)}
                            </div>
                            {p.grossAmount > p.netAmount && (
                              <div className="text-xs text-gray-400 line-through tabular-nums">
                                {formatCurrency(p.grossAmount)}
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
