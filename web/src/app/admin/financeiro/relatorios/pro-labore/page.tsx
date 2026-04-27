"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Wallet,
  ShieldCheck,
  TrendingUp,
  PiggyBank,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  Loader,
  Settings,
  ArrowRight,
  Info,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SummaryCard } from "@/components/ui/summary-card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import CurrencyInput from "@/components/CurrencyInput"
import { formatCurrency } from "@/lib/calculations"
import { useUserRole } from "@/lib/useUserRole"

interface ProLaboreResponse {
  month: string
  receitaBruta: number
  receitaSource: "mp" | "bills_paid"
  mpReleasedNoMes: number
  billsPaidNoMes: number
  mpSyncedAt: string | null
  cmvDoMes: number
  cmvSource: "productCost" | "aporte" | "none"
  cmvFaltando: boolean
  receitaRecebida: number
  despesasPagas: number
  aportesNoMes: number
  aporteMercadoriaNoMes: number
  aportesOperacionaisNoMes: number
  custoOperacionalTotal: number
  lucroLiquido: number
  lucroAcumuladoYTD: number
  proLaboresYTD: number
  baseDisponivel: number
  contasAPagarDoMes: { total: number; count: number; vencendo7d: number }
  aportesADevolver: {
    total: number
    count: number
    amortizacaoSugerida: number
    totalOriginal: number
    totalAmortizado: number
  }
  reserva: {
    meta: number
    atual: number
    despesaFixaMedia: number
    meses: number
    semHistorico: boolean
    pctAtingido: number
    falta: number
  }
  reinvestimento: { pct: number; sugerido: number }
  proLaboreSeguro: number
  proLaboreSubcategoryId: string | null
  historicoPorMes: Array<{ month: string; total: number }>
  saldoCaixa: { informado: boolean; valor: number | null; atualizadoEm: string | null }
}

interface Settings {
  reservaMeses: number
  reinvestPct: number
  saldoCaixaAtual: number | null
  saldoAtualizadoEm: string | null
}

function currentMonthYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function ProLaborePage() {
  const { canWrite } = useUserRole()
  const [month, setMonth] = useState(currentMonthYM())
  const [data, setData] = useState<ProLaboreResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLancar, setShowLancar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAmortize, setShowAmortize] = useState(false)
  const [flash, setFlash] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/relatorios/pro-labore?month=${month}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <PageHeader
        title="💼 Pró-labore seguro"
        description="Quanto você pode tirar esse mês sem comer a operação — Pay Yourself Last."
        actions={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 outline-none"
            />
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              <Settings className="w-4 h-4 mr-1" />
              Config
            </Button>
          </div>
        }
      />

      {flash && (
        <div
          className={`p-3 rounded text-sm ${
            flash.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {flash.text}
        </div>
      )}

      {loading || !data ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            Calculando...
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Fechamento do mês — ordem: entrada → custos → resultado. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryCard
              label="Lucro recebido (mês)"
              value={formatCurrency(data.receitaRecebida)}
              tooltip={
                data.receitaSource === "mp"
                  ? `liberado MP ${formatCurrency(data.receitaBruta)} − mercadoria ${formatCurrency(data.cmvDoMes)}`
                  : `bills pagas ${formatCurrency(data.receitaBruta)} − mercadoria ${formatCurrency(data.cmvDoMes)} (sem sync MP)`
              }
              sub={
                data.cmvDoMes > 0
                  ? `(−) ${formatCurrency(data.cmvDoMes)} de mercadoria`
                  : "sem CMV cadastrado"
              }
              icon={TrendingUp}
              tone="emerald"
            />
            <SummaryCard
              label="Despesas pagas"
              value={formatCurrency(data.despesasPagas)}
              sub="faturas pagas no mês"
              icon={Wallet}
              tone="rose"
            />
            <SummaryCard
              label="Caixa novo do mês"
              value={formatCurrency(data.lucroLiquido)}
              tooltip={
                data.lucroLiquido >= 0
                  ? "lucro recebido − despesas pagas · sobra real do mês"
                  : "saiu mais do que entrou neste mês"
              }
              icon={PiggyBank}
              tone={data.lucroLiquido >= 0 ? "emerald" : "rose"}
            />
          </div>

          {data.receitaSource === "bills_paid" && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Receita estimada</strong> — o Mercado Pago não foi sincronizado, então estamos usando vendas marcadas como pagas (heurística de 30 dias). Pra ver o valor exato que o MP liberou, abre <a href="/admin/financeiro/mercado-pago" className="underline font-medium">Mercado Pago</a> e clica em Atualizar.
              </div>
            </div>
          )}

          {data.cmvFaltando && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Cadastre o custo dos anúncios em Custos ML</strong> — você tem{" "}
                {formatCurrency(data.aporteMercadoriaNoMes)} de aporte em mercadoria no mês que não
                está entrando como CMV. Sem isso, o lucro pode aparecer inflado.
              </div>
            </div>
          )}

          {/* Sugestão principal */}
          <Card className="border-primary-200 dark:border-primary-900/50 bg-gradient-to-br from-primary-50 to-white dark:bg-none dark:bg-card">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="w-14 h-14 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0">
                  <Rocket className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-primary-700 uppercase tracking-wide">
                    Pró-labore sugerido este mês
                  </p>
                  <p className="text-4xl font-bold text-foreground mt-1 tabular-nums">
                    {formatCurrency(data.proLaboreSeguro)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-sm text-muted-foreground">
                      lucro acumulado: <strong className="text-foreground">{formatCurrency(data.lucroAcumuladoYTD)}</strong>
                    </span>
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-muted-foreground hover:text-muted-foreground">
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs space-y-1 max-w-xs p-3">
                          <div className="flex justify-between gap-4 font-semibold">
                            <span>Lucro acumulado</span>
                            <span>{formatCurrency(data.lucroAcumuladoYTD)}</span>
                          </div>
                          {data.proLaboresYTD > 0 && (
                            <>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">− Pró-labores tirados</span>
                                <span className="font-medium">{formatCurrency(data.proLaboresYTD)}</span>
                              </div>
                              <div className="border-t border-border pt-1 flex justify-between gap-4 font-semibold">
                                <span>= Base disponível</span>
                                <span>{formatCurrency(data.baseDisponivel)}</span>
                              </div>
                            </>
                          )}
                          <div className="border-t border-border pt-1 space-y-1">
                            <p className="text-muted-foreground text-[11px] uppercase tracking-wide">deduzido para chegar no pró-labore</p>
                            {data.aportesADevolver.amortizacaoSugerida > 0 && (
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">− Amortização aportes</span>
                                <span className="font-medium">{formatCurrency(data.aportesADevolver.amortizacaoSugerida)}</span>
                              </div>
                            )}
                            {data.reserva.falta > 0 && (
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">− Reserva pendente</span>
                                <span className="font-medium">{formatCurrency(data.reserva.falta)}</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">− Reinvestimento ({data.reinvestimento.pct}%)</span>
                              <span className="font-medium">{formatCurrency(data.reinvestimento.sugerido)}</span>
                            </div>
                            <div className="flex justify-between gap-4 font-semibold text-primary-700">
                              <span>= Pró-labore sugerido</span>
                              <span>{formatCurrency(data.proLaboreSeguro)}</span>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {data.baseDisponivel === 0 && data.lucroLiquido > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded px-2 py-1 mt-2 inline-block">
                      ⚠️ Mês lucrativo, mas o ano ainda acumula prejuízo. O lucro deste mês está cobrindo
                      o déficit antes de liberar pró-labore.
                    </p>
                  )}
                </div>
                {canWrite && data.proLaboreSubcategoryId && (
                  <Button
                    onClick={() => setShowLancar(true)}
                    disabled={data.proLaboreSeguro <= 0}
                    className="whitespace-nowrap"
                  >
                    <ArrowRight className="w-4 h-4 mr-1" />
                    Tirar pró-labore
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Hierarquia */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hierarquia de prioridades</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-gray-100">
                <BucketRow
                  index={1}
                  icon={<Wallet className="w-5 h-5" />}
                  tone="amber"
                  title="Contas a pagar do mês"
                  amount={data.contasAPagarDoMes.total}
                  sub={`${data.contasAPagarDoMes.count} conta(s) · ${data.contasAPagarDoMes.vencendo7d} vencendo em 7 dias`}
                  warning={data.contasAPagarDoMes.vencendo7d > 0}
                />
                <BucketRow
                  index={2}
                  icon={<PiggyBank className="w-5 h-5" />}
                  tone="fuchsia"
                  title="Aportes a devolver"
                  amount={data.aportesADevolver.total}
                  sub={
                    data.aportesADevolver.totalOriginal > 0
                      ? `${data.aportesADevolver.count} aporte(s) pendente(s) · ${formatCurrency(data.aportesADevolver.totalAmortizado)} já amortizado · sugestão ${formatCurrency(data.aportesADevolver.amortizacaoSugerida)}/mês (2 anos)`
                      : "Sem aportes cadastrados"
                  }
                  action={
                    canWrite && data.aportesADevolver.total > 0 ? (
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowAmortize(true)}>
                        <ArrowRight className="w-4 h-4 mr-1" />
                        Amortizar
                      </Button>
                    ) : null
                  }
                />
                <BucketRow
                  index={3}
                  icon={<ShieldCheck className="w-5 h-5" />}
                  tone={
                    data.reserva.semHistorico
                      ? "sky"
                      : data.reserva.pctAtingido >= 100
                      ? "emerald"
                      : "sky"
                  }
                  title={`Reserva de emergência (${data.reserva.meses}m)`}
                  amount={data.reserva.atual}
                  sub={
                    data.reserva.semHistorico
                      ? "Sem histórico de despesas pagas nos últimos 3 meses — não dá pra calcular a meta"
                      : `Meta: ${formatCurrency(data.reserva.meta)} · ${data.reserva.pctAtingido.toFixed(0)}% atingido${data.reserva.falta > 0 ? ` · faltam ${formatCurrency(data.reserva.falta)}` : ""}`
                  }
                  progressPct={data.reserva.semHistorico ? undefined : data.reserva.pctAtingido}
                  pending={data.reserva.semHistorico}
                />
                <BucketRow
                  index={4}
                  icon={<Rocket className="w-5 h-5" />}
                  tone="primary"
                  title="Reinvestimento"
                  amount={data.reinvestimento.sugerido}
                  sub={`${data.reinvestimento.pct}% do lucro líquido pra marketing, estoque, equipamento`}
                />
              </ul>
            </CardContent>
          </Card>

          {/* Histórico */}
          {data.historicoPorMes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de pró-labore</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-gray-100">
                  {data.historicoPorMes.map((h) => (
                    <li key={h.month} className="py-2 flex items-center justify-between">
                      <span className="text-sm text-foreground">{formatMonth(h.month)}</span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {formatCurrency(h.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <LancarProLaboreDialog
        open={showLancar}
        onClose={() => setShowLancar(false)}
        sugestao={data?.proLaboreSeguro ?? 0}
        subcategoryId={data?.proLaboreSubcategoryId ?? null}
        onSuccess={() => {
          setShowLancar(false)
          setFlash({ type: "success", text: "Pró-labore lançado em contas a pagar." })
          setTimeout(() => setFlash(null), 5000)
          load()
        }}
        onError={(msg) => setFlash({ type: "error", text: msg })}
      />

      <SettingsDialog
        open={showSettings}
        onClose={() => {
          setShowSettings(false)
          load()
        }}
      />

      <AmortizeAporteDialog
        open={showAmortize}
        onClose={() => setShowAmortize(false)}
        saldoDevedor={data?.aportesADevolver.total ?? 0}
        sugestao={data?.aportesADevolver.amortizacaoSugerida ?? 0}
        onSuccess={(res) => {
          setShowAmortize(false)
          setFlash({
            type: "success",
            text: `Amortizados ${formatCurrency(res.totalPaid)} em ${res.billsAffected} lançamento(s)${
              res.remaining > 0 ? ` (sobraram ${formatCurrency(res.remaining)} sem aporte pra quitar)` : ""
            }`,
          })
          setTimeout(() => setFlash(null), 8000)
          load()
        }}
        onError={(msg) => setFlash({ type: "error", text: msg })}
      />
    </div>
  )
}

function BucketRow({
  index,
  icon,
  tone,
  title,
  amount,
  sub,
  warning,
  progressPct,
  info,
  pending,
  action,
}: {
  index: number
  icon: React.ReactNode
  tone: "amber" | "fuchsia" | "sky" | "emerald" | "primary"
  title: string
  amount: number
  sub: string
  warning?: boolean
  progressPct?: number
  info?: string
  pending?: boolean
  action?: React.ReactNode
}) {
  const toneCls: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    fuchsia: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    primary: "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300",
  }
  const progressFill: Record<string, string> = {
    amber: "bg-amber-500",
    fuchsia: "bg-fuchsia-500",
    sky: "bg-sky-500",
    emerald: "bg-emerald-500",
    primary: "bg-primary-500",
  }
  return (
    <li className="px-5 py-4 flex items-start gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-muted-foreground w-6">{String(index).padStart(2, "0")}</span>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${toneCls[tone]}`}>
          {icon}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {warning && (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
              <AlertTriangle className="w-3 h-3" />
              Atenção
            </span>
          )}
          {progressPct !== undefined && progressPct >= 100 && (
            <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
              <CheckCircle2 className="w-3 h-3" />
              Atingido
            </span>
          )}
          {pending && (
            <span className="inline-flex items-center gap-1 text-xs bg-muted text-foreground px-2 py-0.5 rounded">
              Pendente
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
        {info && <div className="text-xs text-sky-700 mt-1">💡 {info}</div>}
        {progressPct !== undefined && (
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden max-w-sm">
            <div
              className={`h-full ${progressFill[tone]}`}
              style={{ width: `${Math.min(100, progressPct)}%` }}
            />
          </div>
        )}
      </div>
      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        <div className="text-base font-bold text-foreground tabular-nums whitespace-nowrap">
          {formatCurrency(amount)}
        </div>
        {action}
      </div>
    </li>
  )
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-")
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
}

function LancarProLaboreDialog({
  open,
  onClose,
  sugestao,
  subcategoryId,
  onSuccess,
  onError,
}: {
  open: boolean
  onClose: () => void
  sugestao: number
  subcategoryId: string | null
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const [valor, setValor] = useState(sugestao)
  const [date, setDate] = useState(todayISO())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setValor(sugestao)
      setDate(todayISO())
    }
  }, [open, sugestao])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subcategoryId) {
      onError("Subcategoria 'Pró-labore' não encontrada. Crie em Financeiro > Categorias.")
      return
    }
    if (valor <= 0) {
      onError("Informe um valor maior que zero")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payable",
          billCategoryId: subcategoryId,
          amount: valor,
          dueDate: date,
        }),
      })
      if (res.ok) {
        onSuccess()
      } else {
        const d = await res.json().catch(() => ({}))
        onError(d.error || "Erro ao lançar")
      }
    } catch {
      onError("Erro de conexão")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tirar pró-labore</DialogTitle>
          <DialogDescription>
            Lança uma conta a pagar na categoria <strong>Pessoal &gt; Pró-labore</strong>. Marque como paga quando
            transferir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Valor (R$)</label>
            <CurrencyInput
              value={valor}
              onChange={setValor}
              placeholder="R$ 0,00"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Sugestão: {formatCurrency(sugestao)} (o cálculo considera suas prioridades)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || valor <= 0}>
              {submitting && <Loader className="w-4 h-4 animate-spin mr-2" />}
              Lançar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AmortizeAporteDialog({
  open,
  onClose,
  saldoDevedor,
  sugestao,
  onSuccess,
  onError,
}: {
  open: boolean
  onClose: () => void
  saldoDevedor: number
  sugestao: number
  onSuccess: (res: { totalPaid: number; billsAffected: number; remaining: number }) => void
  onError: (msg: string) => void
}) {
  const [valor, setValor] = useState(sugestao)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setValor(sugestao > 0 ? sugestao : saldoDevedor)
  }, [open, sugestao, saldoDevedor])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (valor <= 0) {
      onError("Informe um valor maior que zero")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/bills/amortize-aporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: valor }),
      })
      const d = await res.json()
      if (res.ok) {
        onSuccess(d)
      } else {
        onError(d.error || "Erro ao amortizar")
      }
    } catch {
      onError("Erro de conexão")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Amortizar aporte</DialogTitle>
          <DialogDescription>
            A loja paga de volta parte ou o total do aporte. Bills mais antigas são quitadas primeiro
            (FIFO). Se o valor não cobrir a última bill, ela é dividida.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Valor (R$)</label>
            <CurrencyInput
              value={valor}
              onChange={setValor}
              placeholder="R$ 0,00"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
            />
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              <p>
                Saldo devedor: <strong>{saldoDevedor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
              </p>
              <p>
                Sugestão mensal (1/24): <strong>{sugestao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
              </p>
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200">
            ⚠️ Essa ação marca as bills mais antigas de <strong>Aporte sócio</strong> como pagas, na
            data de hoje. Se quiser reverter, vá em Contas a pagar e volte o status pra pendente.
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || valor <= 0}>
              {submitting && <Loader className="w-4 h-4 animate-spin mr-2" />}
              Amortizar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [meses, setMeses] = useState(3)
  const [pct, setPct] = useState(20)
  const [saldo, setSaldo] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch("/api/financial-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Settings | null) => {
        if (!s) return
        setSettings(s)
        setMeses(s.reservaMeses)
        setPct(s.reinvestPct)
        setSaldo(s.saldoCaixaAtual ?? 0)
      })
  }, [open])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await fetch("/api/financial-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservaMeses: meses,
          reinvestPct: pct,
          saldoCaixaAtual: saldo,
        }),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações do pró-labore</DialogTitle>
          <DialogDescription>
            Parâmetros que alimentam o cálculo do valor seguro.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Reserva de emergência (meses de despesa fixa)
            </label>
            <input
              type="number"
              min="0"
              max="24"
              value={meses}
              onChange={(e) => setMeses(Number(e.target.value))}
              className="w-full px-3 py-2 border border-border rounded-lg"
            />
            <p className="text-xs text-muted-foreground mt-1">Padrão indústria: 3 meses (mínimo), 6 meses (conservador)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Reinvestimento (% do lucro líquido)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              className="w-full px-3 py-2 border border-border rounded-lg"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Padrão e-commerce: 20% (crescimento), 10% (maduro), 30%+ (bootstrap agressivo)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Saldo em caixa atual (R$)
            </label>
            <CurrencyInput
              value={saldo}
              onChange={setSaldo}
              placeholder="R$ 0,00"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Quanto você tem disponível hoje (conta bancária + MP disponível). Usado pra calcular se a reserva tá
              cumprida.
              {settings?.saldoAtualizadoEm && (
                <>
                  {" "}
                  Atualizado em {new Date(settings.saldoAtualizadoEm).toLocaleDateString("pt-BR")}.
                </>
              )}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader className="w-4 h-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
