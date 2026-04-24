"use client"

import { useEffect, useState } from "react"
import { Loader, AlertTriangle, Landmark, TrendingUp, TrendingDown } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/calculations"

interface Balanco {
  month: string
  ativo: {
    caixa: number
    caixaInformado: boolean
    caixaAtualizadoEm: string | null
    mpALiberar: number
    mpSyncedAt: string | null
    contasReceber: number
    total: number
  }
  passivo: {
    contasPagar: number
    aportesADevolver: number
    aportesLancados: number
    amortizadoAcumulado: number
    proLaboresPendentes: number
    total: number
  }
  patrimonioLiquido: {
    lucroAcumuladoYTD: number
    proLaboresPagosYTD: number
    total: number
  }
  passivoMaisPL: number
  descasamento: number
}

function currentMonthYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function BalancoPage() {
  const [month, setMonth] = useState(currentMonthYM())
  const [data, setData] = useState<Balanco | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingZero, setSavingZero] = useState(false)

  const reload = () => {
    setLoading(true)
    fetch(`/api/relatorios/balanco?month=${month}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const marcarSemCaixa = async () => {
    if (savingZero) return
    setSavingZero(true)
    try {
      const res = await fetch("/api/financial-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saldoCaixaAtual: 0 }),
      })
      if (res.ok) reload()
    } finally {
      setSavingZero(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="📊 Balanço Patrimonial"
        description="Foto do patrimônio na data de corte: o que a loja tem, o que deve e o valor do negócio."
        actions={
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 outline-none"
          />
        }
      />

      {loading || !data ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-gray-500">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            Calculando...
          </CardContent>
        </Card>
      ) : (
        <>
          {!data.ativo.caixaInformado && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong>Saldo em caixa não informado</strong> — se você tem conta bancária / dinheiro
                vivo, cadastre o saldo em <code>Pró-labore &gt; Config</code>. Se todo seu dinheiro
                fica no Mercado Pago, clique no botão ao lado — o balanço vai fechar.
              </div>
              <button
                onClick={marcarSemCaixa}
                disabled={savingZero}
                className="shrink-0 text-xs font-medium bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-900 px-3 py-1.5 rounded-md whitespace-nowrap"
              >
                {savingZero ? "Salvando..." : "Só uso Mercado Pago"}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ATIVO */}
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-white">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                  <TrendingUp className="w-5 h-5" />
                  ATIVO
                  <span className="text-xs text-gray-500 font-normal">(o que a loja tem)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <LineTable
                  rows={[
                    {
                      label: "Caixa / conta bancária",
                      value: data.ativo.caixa,
                      caption: data.ativo.caixaInformado
                        ? data.ativo.caixaAtualizadoEm
                          ? `atualizado em ${new Date(data.ativo.caixaAtualizadoEm).toLocaleDateString("pt-BR")}`
                          : undefined
                        : "não informado",
                    },
                    {
                      label: "Mercado Pago a liberar",
                      value: data.ativo.mpALiberar,
                      caption: data.ativo.mpSyncedAt
                        ? `sync ${new Date(data.ativo.mpSyncedAt).toLocaleDateString("pt-BR")}`
                        : "nunca sincronizado",
                    },
                    {
                      label: "Outras contas a receber",
                      value: data.ativo.contasReceber,
                      caption: "bills receivable pending (fora ML)",
                    },
                    {
                      label: "TOTAL DO ATIVO",
                      value: data.ativo.total,
                      emphasis: true,
                    },
                  ]}
                />
              </CardContent>
            </Card>

            {/* PASSIVO + PL */}
            <div className="space-y-4">
              <Card className="border-rose-200 bg-gradient-to-br from-rose-50/40 to-white">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-rose-700">
                    <TrendingDown className="w-5 h-5" />
                    PASSIVO
                    <span className="text-xs text-gray-500 font-normal">(o que deve)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <LineTable
                    rows={[
                      {
                        label: "Contas a pagar",
                        value: data.passivo.contasPagar,
                        caption: "pending · operacional (exclui aporte e pró-labore)",
                      },
                      {
                        label: "Aportes a devolver ao sócio",
                        value: data.passivo.aportesADevolver,
                        caption: `lançado ${formatCurrency(data.passivo.aportesLancados)} − amortizado ${formatCurrency(data.passivo.amortizadoAcumulado)}`,
                      },
                      {
                        label: "Pró-labores pendentes",
                        value: data.passivo.proLaboresPendentes,
                        caption: "lançado mas não pago ainda",
                      },
                      {
                        label: "TOTAL DO PASSIVO",
                        value: data.passivo.total,
                        emphasis: true,
                      },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card className="border-primary-200 bg-gradient-to-br from-primary-50/40 to-white">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-primary-700">
                    <Landmark className="w-5 h-5" />
                    PATRIMÔNIO LÍQUIDO
                    <span className="text-xs text-gray-500 font-normal">(valor do negócio)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <LineTable
                    rows={[
                      {
                        label: "Lucros acumulados (YTD)",
                        value: data.patrimonioLiquido.lucroAcumuladoYTD,
                        caption: "receita − CMV − despesas do ano",
                      },
                      {
                        label: "(−) Pró-labores pagos (YTD)",
                        value: -data.patrimonioLiquido.proLaboresPagosYTD,
                        negative: true,
                      },
                      {
                        label: "TOTAL DO PL",
                        value: data.patrimonioLiquido.total,
                        emphasis: true,
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Fechamento: Ativo = Passivo + PL */}
          <Card
            className={`border-2 ${Math.abs(data.descasamento) < 0.01 ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"}`}
          >
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Ativo</p>
                  <p className="text-xl font-bold text-emerald-700">{formatCurrency(data.ativo.total)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Passivo + PL</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(data.passivoMaisPL)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Descasamento</p>
                  <p
                    className={`text-xl font-bold ${Math.abs(data.descasamento) < 0.01 ? "text-emerald-700" : "text-amber-700"}`}
                  >
                    {formatCurrency(data.descasamento)}
                  </p>
                  {Math.abs(data.descasamento) >= 0.01 && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {data.descasamento > 0
                        ? "ativo não explicado — provavelmente falta informar saldo em caixa"
                        : "passivo maior que ativo — verifique lançamentos"}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-gray-500">
            Balanço gerencial, não contábil. Usa regime de caixa pra ativo, regime de competência
            pra lucros acumulados no PL. Pra fechar perfeitamente Ativo = Passivo + PL, informe o
            saldo real em caixa em Pró-labore &gt; Config.
          </p>
        </>
      )}
    </div>
  )
}

function LineTable({
  rows,
}: {
  rows: Array<{
    label: string
    value: number
    caption?: string
    emphasis?: boolean
    negative?: boolean
  }>
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={i}
            className={`border-b border-gray-100 last:border-0 ${r.emphasis ? "bg-gray-50 font-semibold" : ""}`}
          >
            <td className={`px-5 py-3 ${r.emphasis ? "text-gray-900 uppercase text-xs tracking-wide" : "text-gray-700"}`}>
              {r.label}
              {r.caption && <div className="text-xs text-gray-400 font-normal normal-case mt-0.5">{r.caption}</div>}
            </td>
            <td
              className={`px-5 py-3 text-right tabular-nums whitespace-nowrap ${
                r.emphasis
                  ? "text-gray-900 font-bold"
                  : r.negative
                  ? "text-rose-600"
                  : r.value < 0
                  ? "text-rose-600"
                  : "text-gray-900"
              }`}
            >
              {formatCurrency(r.value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
