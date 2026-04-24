"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/calculations"

interface Payment {
  id: number
  description: string
  netAmount: number
  grossAmount: number
  dateCreated: string | null
  statusDetail: string | null
  paymentMethodId: string | null
  buyer: string | null
  externalReference: string | null
}
interface Response {
  configured: boolean
  total?: number
  count?: number
  payments?: Payment[]
  lastUpdated?: string
  error?: string
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

const STATUS_DETAIL_LABELS: Record<string, string> = {
  in_mediation: "Em mediação",
  pending_waiting_buyer: "Aguardando comprador",
  pending_waiting_review: "Em análise do MP",
}

export function MercadoPagoDisputedCard() {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/mp/disputed")
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

  if (!data || !data.configured) return null

  if (data.error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-5 flex items-center gap-2 text-sm text-red-800">
          <AlertTriangle className="w-4 h-4" />
          Retido por reclamação: {data.error}
          <Button variant="outline" size="sm" className="ml-auto" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Se não tem nenhum em mediação, mostra card discreto "tudo tranquilo"
  if (!data.count || data.count === 0) {
    return (
      <Card className="border-gray-200">
        <CardContent className="pt-5 flex items-center gap-3 text-sm">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">Sem reclamações em aberto</p>
            <p className="text-xs text-gray-500">Nenhum pagamento retido por mediação no MP.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardContent>
      </Card>
    )
  }

  const payments = data.payments || []
  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2 text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          Retido por reclamação
        </CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3 flex-wrap mb-3">
          <span className="text-3xl font-bold text-amber-700 tabular-nums">
            {formatCurrency(data.total ?? 0)}
          </span>
          <span className="text-sm text-gray-600">
            em <strong>{data.count}</strong> pagamento{data.count === 1 ? "" : "s"} em mediação
          </span>
        </div>
        <p className="text-xs text-gray-600">
          Dinheiro que o MP segurou até resolver a disputa do comprador. Responda pelo app do MP
          pra destravar.
        </p>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 text-sm text-amber-800 font-medium flex items-center gap-1 hover:text-amber-900"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {expanded ? "Esconder" : "Ver"} pagamentos
        </button>

        {expanded && (
          <ul className="mt-3 divide-y divide-amber-200 border-t border-amber-200">
            {payments.map((p) => {
              const method = p.paymentMethodId
                ? METHOD_LABELS[p.paymentMethodId] || p.paymentMethodId
                : null
              const statusLabel = p.statusDetail
                ? STATUS_DETAIL_LABELS[p.statusDetail] || p.statusDetail
                : null
              return (
                <li key={p.id} className="py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 line-clamp-1">{p.description}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="font-mono">#{p.id}</span>
                      {p.dateCreated && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span>
                            aprovado {new Date(p.dateCreated).toLocaleDateString("pt-BR")}
                          </span>
                        </>
                      )}
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
                      {statusLabel && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-amber-700 font-medium">{statusLabel}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-amber-700 tabular-nums whitespace-nowrap">
                    {formatCurrency(p.netAmount)}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
