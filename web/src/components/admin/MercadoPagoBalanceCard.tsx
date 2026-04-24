"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Wallet, RefreshCw, AlertCircle, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/calculations"

interface BalanceResponse {
  configured: boolean
  unavailableBalance?: number
  pendingReleaseCount?: number
  currencyId?: string
  lastUpdated?: string | null
  error?: string
}

/**
 * Card que exibe o "Total a liberar" no Mercado Pago (unavailable_balance).
 * Aparece no topo de /admin/financeiro/contas-a-receber.
 */
export function MercadoPagoBalanceCard() {
  const [data, setData] = useState<BalanceResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/mp/balance")
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

  // Não conectado: mostra call-to-action discreto
  if (data && !data.configured) {
    return (
      <Card className="border-sky-200 bg-sky-50/40">
        <CardContent className="pt-5 flex items-center gap-4 flex-wrap">
          <div className="w-11 h-11 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Mercado Pago não conectado</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Conecte pra ver o total a liberar direto aqui.
            </p>
          </div>
          <Link
            href="/admin/configuracoes?tab=ml"
            className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2 rounded-lg text-sm"
          >
            Conectar
          </Link>
        </CardContent>
      </Card>
    )
  }

  // Erro
  if (data?.error) {
    return (
      <Card className="border-red-200 bg-red-50/40">
        <CardContent className="pt-5 flex items-center gap-3 flex-wrap">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="flex-1 text-sm text-red-800">
            <strong>Mercado Pago:</strong> {data.error}
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-white">
      <CardContent className="pt-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-11 h-11 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sky-700 uppercase tracking-wide">
              Total a liberar · Mercado Pago
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">
              {loading || !data
                ? "—"
                : formatCurrency(data.unavailableBalance ?? 0)}
            </p>
            {data && (
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-600 flex-wrap">
                <span>
                  <strong className="text-gray-900">{data.pendingReleaseCount ?? 0}</strong> pagamento(s) aguardando liberação
                </span>
                {data.lastUpdated && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-400">
                      atualizado {new Date(data.lastUpdated).toLocaleString("pt-BR")}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
