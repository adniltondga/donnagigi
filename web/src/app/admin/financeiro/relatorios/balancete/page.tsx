"use client"

import { useEffect, useState } from "react"
import {
  Loader,
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  Scale,
  Calendar,
} from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/calculations"

interface Balancete {
  month: string
  resultado: {
    receitaBruta: number
    cmvDoMes: number
    cmvSource: "productCost" | "aporte" | "none"
    receitaLiquida: number
    despesasPagas: number
    aportesOperacionais: number
    lucroLiquido: number
  }
  movimento: {
    entradas: number
    saidasOperacionais: number
    saidasAmortizacao: number
    saidasProLabore: number
    saidasTotal: number
    fluxoLiquido: number
  }
  posicao: {
    aportesADevolver: number
    aportesLancados: number
    amortizadoAcumulado: number
    contasPagarPendentes: number
    contasReceberPendentes: number
    mpALiberar: number
    mpSyncedAt: string | null
    lucroAcumuladoYTD: number
    proLaboresYTD: number
  }
}

function currentMonthYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-")
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  })
}

export default function BalancetePage() {
  const [month, setMonth] = useState(currentMonthYM())
  const [data, setData] = useState<Balancete | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/relatorios/balancete?month=${month}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false))
  }, [month])

  return (
    <div className="space-y-6">
      <PageHeader
        title="📒 Balancete gerencial"
        description="Resultado + caixa + posição patrimonial. Visão completa da saúde financeira no mês."
        actions={
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 outline-none"
          />
        }
      />

      {loading || !data ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            Calculando...
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Resumo executivo no topo */}
          <Card
            className={`border-2 ${
              data.resultado.lucroLiquido >= 0
                ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
                : "border-rose-200 bg-gradient-to-br from-rose-50 to-white"
            }`}
          >
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Lucro líquido · {formatMonthLabel(data.month)}
                  </p>
                  <p
                    className={`text-4xl font-bold tabular-nums mt-1 ${
                      data.resultado.lucroLiquido >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(data.resultado.lucroLiquido)}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-muted-foreground">Acumulado do ano (YTD)</p>
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      data.posicao.lucroAcumuladoYTD >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(data.posicao.lucroAcumuladoYTD)}
                  </p>
                  {data.posicao.proLaboresYTD > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Pró-labores tirados YTD: <strong>{formatCurrency(data.posicao.proLaboresYTD)}</strong>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bloco 1: Resultado (DRE resumida) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="w-5 h-5 text-primary-600" />
                Resultado do mês (competência)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <LineTable
                rows={[
                  { label: "Receita bruta recebida", value: data.resultado.receitaBruta, bold: true },
                  {
                    label: `(−) CMV · custo mercadoria${data.resultado.cmvSource === "aporte" ? " (via aporte)" : data.resultado.cmvSource === "productCost" ? " (via Custos ML)" : ""}`,
                    value: -data.resultado.cmvDoMes,
                    negative: true,
                  },
                  {
                    label: "= Lucro real recebido",
                    value: data.resultado.receitaLiquida,
                    bold: true,
                    emphasis: true,
                  },
                  {
                    label: "(−) Despesas operacionais pagas",
                    value: -data.resultado.despesasPagas,
                    negative: true,
                  },
                  {
                    label: "(−) Aportes operacionais (embalagem, frete, outros)",
                    value: -data.resultado.aportesOperacionais,
                    negative: true,
                  },
                  {
                    label: "= Lucro líquido do mês",
                    value: data.resultado.lucroLiquido,
                    bold: true,
                    final: true,
                  },
                ]}
              />
            </CardContent>
          </Card>

          {/* Bloco 2: Movimento de caixa (regime de caixa) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-5 h-5 text-sky-600" />
                Movimento de caixa (o que entrou e saiu de fato)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <LineTable
                rows={[
                  { label: "(+) Entradas (receitas pagas)", value: data.movimento.entradas, bold: true },
                  { label: "(−) Saídas operacionais", value: -data.movimento.saidasOperacionais, negative: true },
                  { label: "(−) Amortização de aporte", value: -data.movimento.saidasAmortizacao, negative: true },
                  { label: "(−) Pró-labore pago", value: -data.movimento.saidasProLabore, negative: true },
                  { label: "= Fluxo líquido", value: data.movimento.fluxoLiquido, bold: true, final: true },
                ]}
              />
            </CardContent>
          </Card>

          {/* Bloco 3: Posição patrimonial */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  Direitos / A receber
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <LineTable
                  rows={[
                    {
                      label: "Mercado Pago a liberar",
                      value: data.posicao.mpALiberar,
                      caption: data.posicao.mpSyncedAt
                        ? `sync ${new Date(data.posicao.mpSyncedAt).toLocaleDateString("pt-BR")}`
                        : "nunca sincronizado",
                    },
                    {
                      label: "Outras contas a receber",
                      value: data.posicao.contasReceberPendentes,
                      caption: "receivable pending (exceto ML)",
                    },
                    {
                      label: "Total a receber",
                      value:
                        Math.round(
                          (data.posicao.mpALiberar + data.posicao.contasReceberPendentes) * 100
                        ) / 100,
                      bold: true,
                      emphasis: true,
                    },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-rose-600" />
                  Obrigações / A pagar
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <LineTable
                  rows={[
                    {
                      label: "Contas a pagar pendentes",
                      value: data.posicao.contasPagarPendentes,
                      caption: "bills payable pending (operacional)",
                    },
                    {
                      label: "Aportes a devolver",
                      value: data.posicao.aportesADevolver,
                      caption: `lançado ${formatCurrency(data.posicao.aportesLancados)} − amortizado ${formatCurrency(data.posicao.amortizadoAcumulado)}`,
                    },
                    {
                      label: "Total a pagar",
                      value:
                        Math.round(
                          (data.posicao.contasPagarPendentes + data.posicao.aportesADevolver) * 100
                        ) / 100,
                      bold: true,
                      emphasis: true,
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          {/* Saldo (direitos − obrigações) */}
          <Card className="border-2 border-primary-200 bg-primary-50/40">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Landmark className="w-6 h-6 text-primary-700" />
                  <div>
                    <p className="text-xs text-primary-700 uppercase tracking-wide">
                      Patrimônio líquido estimado
                    </p>
                    <p className="text-xs text-muted-foreground">
                      direitos − obrigações (não considera estoque ou imobilizado)
                    </p>
                  </div>
                </div>
                <p
                  className={`text-3xl font-bold tabular-nums ${
                    patrimonio(data) >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {formatCurrency(patrimonio(data))}
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Calendar className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Balancete gerencial, não contábil. <strong>Resultado</strong> usa regime de competência
              (data do pedido). <strong>Movimento</strong> e <strong>Posição</strong> usam regime de
              caixa (data do pagamento efetivo). CMV = max(productCost, aporte mercadoria) pra evitar
              double count.
            </span>
          </p>
        </>
      )}
    </div>
  )
}

function patrimonio(d: Balancete): number {
  const ativos = d.posicao.mpALiberar + d.posicao.contasReceberPendentes
  const passivos = d.posicao.contasPagarPendentes + d.posicao.aportesADevolver
  return Math.round((ativos - passivos) * 100) / 100
}

function LineTable({
  rows,
}: {
  rows: Array<{
    label: string
    value: number
    bold?: boolean
    negative?: boolean
    emphasis?: boolean
    final?: boolean
    caption?: string
  }>
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={i}
            className={`border-b border-border last:border-0 ${
              r.emphasis ? "bg-muted" : ""
            } ${r.final ? "bg-primary-50/40 border-t-2 border-primary-200" : ""}`}
          >
            <td className={`px-5 py-3 ${r.bold ? "font-semibold text-foreground" : "text-foreground"}`}>
              {r.label}
              {r.caption && <div className="text-xs text-muted-foreground font-normal mt-0.5">{r.caption}</div>}
            </td>
            <td
              className={`px-5 py-3 text-right tabular-nums whitespace-nowrap ${
                r.final
                  ? r.value >= 0
                    ? "text-emerald-600 font-bold text-base"
                    : "text-red-600 font-bold text-base"
                  : r.negative
                  ? "text-rose-600"
                  : r.bold
                  ? "text-foreground font-semibold"
                  : "text-foreground"
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
