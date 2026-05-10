"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  RefreshCw,
  Wallet,
  Package,
  TrendingUp,
  HandCoins,
  AlertTriangle,
  ArrowRight,
  X,
  Users,
  Plus,
  Info,
} from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatCurrency } from "@/lib/calculations"

// ---------- Tipos das respostas das APIs reusadas ----------

interface MPSnapshot {
  configured: boolean
  unavailableBalance?: number
  pendingCount?: number
  releasedTotal?: number
  releasedCount?: number
  disputedTotal?: number
  disputedCount?: number
  cachedSyncedAt?: string | null
  error?: string
}

interface ProLaboreResp {
  month: string
  receitaBruta: number
  receitaSource: "mp" | "bills_paid"
  mpReleasedNoMes: number
  mpSyncedAt: string | null
  cmvDoMes: number
  reposicaoPagaNoMes: number
  pendenteReposicao: number
  adiantadoReposicao: number
  caixaDoMes: number
  receitaRecebida: number
  despesasPagas: number
  cmvFaltando: boolean
  custoOperacionalTotal: number
  lucroLiquido: number
  lucroAcumuladoYTD: number
  proLaboresYTD: number
  baseDisponivel: number
  contasAPagarDoMes: { total: number; count: number; vencendo7d: number }
  aportesADevolver: { total: number; count: number; amortizacaoSugerida: number }
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
  proLaboreDireto: number
  proLaboreSeguro: number
  proLaborePct: number
  saidasParaSocioMes: number
  aportesPagosMes: number
  amortizacoesPagasMes: number
  saidasParaSocioYTD: number
  aportesPagosYTD: number
  amortizacoesPagasYTD: number
  billsCorrespondentesSemCusto: number
  paymentsSemMatch: number
}

interface CashPoolsResp {
  vendasLiquidas: number
  cmv: number
  vendasSemCusto: number
  vendasTotais: number
  alocadoReposicao: number
  gastoReposicao: number
  caixaReposicao: number
  caixaReserva: number
}

interface DreMonth {
  month: number
  dre: { lucroLiquido: number }
}

interface DreAnualResp {
  year: number
  basis: string
  months: DreMonth[]
  total: { lucroLiquido: number }
}

interface ReposicaoMes {
  ym: string
  vendaBruta: number
  cmv: number
  reposto: number
  saldo: number
  vendasCount: number
  vendasSemCusto: number
  reposicoesCount: number
}

interface ReposicaoDetalhes {
  vendaBrutaTotal: number
  cmvTotal: number
  repostoTotal: number
  saldoTotal: number
  vendasSemCusto: number
  meses: ReposicaoMes[]
}

type Mode = "geral" | "mes"

// ---------- Helpers ----------

function currentMonthYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "nunca"
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return "agora"
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

// ---------- Card primitive ----------

function MetricCard({
  icon,
  iconColor,
  title,
  tooltip,
  children,
}: {
  icon: React.ReactNode
  iconColor: string
  title: string
  tooltip?: string
  children: React.ReactNode
}) {
  return (
    <Card className="h-full">
      <CardContent className="pt-5 pb-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor}`}>
            {icon}
          </div>
          <h3 className="text-base font-medium text-foreground flex-1 min-w-0 truncate">
            {title}
          </h3>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Mais info">
                  <Info className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

// Bloco de valor primário — usado no centro de todos os cards.
function PrimaryValue({ value, negative }: { value: number; negative?: boolean }) {
  return (
    <p
      className={`text-2xl font-bold ${negative && value < 0 ? "text-red-600" : "text-foreground"}`}
    >
      {formatCurrency(value)}
    </p>
  )
}

// Grid de até 2 stats secundários, padronizado.
function StatsGrid({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: "amber" | "muted" }>
}) {
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
      {items.map((s, i) => (
        <div key={i} className={i > 0 ? "border-l border-border pl-4" : ""}>
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p
            className={`text-sm font-semibold ${
              s.tone === "amber" ? "text-amber-700" : "text-foreground"
            }`}
          >
            {s.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// Footer padrão: ação primária à esquerda + ação secundária discreta à direita.
function CardFooter({
  primary,
  secondary,
}: {
  primary?: React.ReactNode
  secondary?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2 mt-auto">
      <div className="flex-1">{primary}</div>
      {secondary && <div className="text-xs text-muted-foreground">{secondary}</div>}
    </div>
  )
}

// ---------- Modal de retirada ----------

function RetirarModal({
  open,
  onClose,
  disponivel,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  disponivel: number
  onConfirm: (amount: number, description: string) => Promise<void>
}) {
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount(disponivel > 0 ? disponivel.toFixed(2) : "")
      setDescription("")
      setError(null)
    }
  }, [open, disponivel])

  const submit = async () => {
    const n = Number(amount.replace(",", "."))
    if (!Number.isFinite(n) || n <= 0) {
      setError("Valor inválido")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(n, description)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao registrar")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar retirada de pró-labore</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Disponível pra retirada agora: <b>{formatCurrency(disponivel)}</b>
          </p>
          <div className="space-y-1">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="desc">Descrição (opcional)</Label>
            <Input
              id="desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Retirada de pró-labore"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Esta retirada será lançada como despesa de pró-labore no DRE deste mês — não infla o lucro do mês seguinte.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Registrando..." : "Confirmar retirada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Modal de lançar reposição ----------

function LancarReposicaoModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (amount: number, description: string, date: string) => Promise<void>
}) {
  const todayISO = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(todayISO())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount("")
      setDescription("")
      setDate(todayISO())
      setError(null)
    }
  }, [open])

  const submit = async () => {
    const n = Number(amount.replace(",", "."))
    if (!Number.isFinite(n) || n <= 0) {
      setError("Valor inválido")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(n, description, date)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao registrar")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar reposição de mercadoria</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="r-amount">Valor (R$)</Label>
            <Input
              id="r-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-desc">Descrição (opcional)</Label>
            <Input
              id="r-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Reposição de estoque"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-date">Data da compra</Label>
            <Input
              id="r-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Lançado como compra de mercadoria já paga. Abate do saldo a repor — não entra como despesa no DRE pra não duplicar com o CMV das vendas.
          </p>
          <p className="text-xs text-muted-foreground">
            Pra frete, embalagem ou outras despesas operacionais, lance em Contas com a categoria correta.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Registrando..." : "Confirmar reposição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Modal de detalhes da reposição ----------

function ReposicaoDetalhesModal({
  open,
  onClose,
  data,
  loading,
}: {
  open: boolean
  onClose: () => void
  data: ReposicaoDetalhes | null
  loading: boolean
}) {
  const fmtMonth = (ym: string) => {
    const [y, m] = ym.split("-")
    const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
    return `${meses[Number(m) - 1] ?? m}/${y.slice(2)}`
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reposição de mercadoria — histórico</DialogTitle>
        </DialogHeader>

        {loading && !data ? (
          <div className="py-8 text-sm text-muted-foreground text-center">Carregando...</div>
        ) : !data ? (
          <div className="py-8 text-sm text-muted-foreground text-center">Sem dados.</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 py-2">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">CMV (custo)</p>
                  <p className="text-lg font-bold">{formatCurrency(data.cmvTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Reposto</p>
                  <p className="text-lg font-bold">{formatCurrency(data.repostoTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Saldo a repor</p>
                  <p
                    className={`text-lg font-bold ${data.saldoTotal > 0 ? "text-rose-700" : "text-emerald-700"}`}
                  >
                    {formatCurrency(data.saldoTotal)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {data.vendasSemCusto > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  {data.vendasSemCusto} venda(s) sem custo cadastrado — CMV pode estar subestimado.
                </span>
              </div>
            )}

            {data.meses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum movimento registrado ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left py-2 px-2">Mês</th>
                      <th className="text-right py-2 px-2">CMV (custo)</th>
                      <th className="text-right py-2 px-2">Reposto</th>
                      <th className="text-right py-2 px-2">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.meses.map((m) => (
                      <tr key={m.ym} className="border-b border-border/50 hover:bg-accent/30">
                        <td className="py-2 px-2 font-medium">{fmtMonth(m.ym)}</td>
                        <td className="py-2 px-2 text-right">
                          <span title={m.vendasSemCusto > 0 ? `${m.vendasSemCusto} venda(s) sem custo cadastrado` : undefined}>
                            {formatCurrency(m.cmv)}
                            {m.vendasCount > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({m.vendasCount})
                              </span>
                            )}
                            {m.vendasSemCusto > 0 && (
                              <span className="text-amber-600 ml-1" aria-label="Vendas sem custo">⚠</span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          {formatCurrency(m.reposto)}
                          {m.reposicoesCount > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({m.reposicoesCount})
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2 px-2 text-right font-semibold ${m.saldo > 0 ? "text-rose-700" : m.saldo < 0 ? "text-emerald-700" : ""}`}
                        >
                          {formatCurrency(m.saldo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-xs text-muted-foreground pt-2 space-y-1">
              <p>
                <b>Critério:</b> mesmo do DRE — vendas não-canceladas com paidDate (caixa real),
                CMV abate refunds parciais.
              </p>
              <p>
                Saldo positivo = mês em que vendeu mais do que repôs (precisa repor depois).
                Saldo negativo = mês em que adiantou estoque pra meses futuros.
              </p>
              <p>
                <span className="text-amber-600">⚠</span> indica vendas sem custo cadastrado — o CMV
                desse mês está subestimado.
              </p>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Modal de configurar % do pró-labore ----------

function ConfigPctModal({
  open,
  onClose,
  currentPct,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  currentPct: number
  onConfirm: (pct: number) => Promise<void>
}) {
  const [pct, setPct] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPct(currentPct.toString())
      setError(null)
    }
  }, [open, currentPct])

  const submit = async () => {
    const n = Number(pct.replace(",", "."))
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setError("Valor precisa estar entre 0 e 100")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(n)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>% retirável de pró-labore</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Quanto do caixa do mês (após pagar sócio) vira retirável.
            Exemplo: <b>80%</b> retira pra você, 20% fica de buffer pra empresa.
          </p>
          <div className="space-y-1">
            <Label htmlFor="cfg-pct">% retirável</Label>
            <Input
              id="cfg-pct"
              type="text"
              inputMode="decimal"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder="100"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Page ----------

export default function PainelPage() {
  const [mode, setMode] = useState<Mode>("geral")
  const [mp, setMp] = useState<MPSnapshot | null>(null)
  const [pro, setPro] = useState<ProLaboreResp | null>(null)
  const [cashLifetime, setCashLifetime] = useState<CashPoolsResp | null>(null)
  const [dreAnual, setDreAnual] = useState<DreAnualResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showRetirar, setShowRetirar] = useState(false)
  const [showConfigPct, setShowConfigPct] = useState(false)
  const [showReposicao, setShowReposicao] = useState(false)
  const [showLancarReposicao, setShowLancarReposicao] = useState(false)
  const [reposicaoDetalhes, setReposicaoDetalhes] = useState<ReposicaoDetalhes | null>(null)
  const [reposicaoLoading, setReposicaoLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monthYM = useMemo(() => currentMonthYM(), [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const year = monthYM.slice(0, 4)
      const [mpRes, proRes, cashRes, dreRes] = await Promise.all([
        fetch("/api/mp/snapshot", { cache: "no-store" }),
        fetch(`/api/relatorios/pro-labore?month=${monthYM}`, { cache: "no-store" }),
        // Cash-pools com período "lifetime" (start de 2010 cobre qualquer histórico
        // de venda ML real). end default = now. Usado pelo card Reposição em Geral.
        fetch("/api/financeiro/cash-pools?start=2010-01-01", { cache: "no-store" }),
        // DRE anual — fonte oficial do lucro (mesmo cálculo dos relatórios).
        // Uma chamada já dá os 12 meses + total YTD do ano corrente.
        fetch(`/api/relatorios/dre-anual?year=${year}&basis=caixa`, { cache: "no-store" }),
      ])
      const mpJson = (await mpRes.json()) as MPSnapshot
      const proJson = (await proRes.json()) as ProLaboreResp | { error: string }
      if ("error" in proJson) throw new Error(proJson.error)
      const cashJson = (await cashRes.json()) as CashPoolsResp | { error: string }
      const dreJson = (await dreRes.json()) as DreAnualResp | { error: string }
      setMp(mpJson)
      setPro(proJson)
      if (!("error" in cashJson)) setCashLifetime(cashJson)
      if (!("error" in dreJson)) setDreAnual(dreJson)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar")
    } finally {
      setLoading(false)
    }
  }, [monthYM])

  useEffect(() => {
    void load()
  }, [load])

  const refreshMP = async () => {
    setRefreshing(true)
    try {
      await fetch("/api/mp/snapshot", { method: "POST" })
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  const handleConfigPct = async (pct: number) => {
    const r = await fetch("/api/financeiro/pro-labore/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proLaborePct: pct }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      throw new Error(j?.error || "Falha ao salvar")
    }
    await load()
  }

  const handleRetirar = async (amount: number, description: string) => {
    const r = await fetch("/api/financeiro/pro-labore/retirar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, description }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      throw new Error(j?.error || "Falha ao registrar retirada")
    }
    await load()
  }

  const openReposicao = async () => {
    setShowReposicao(true)
    if (reposicaoDetalhes) return // cache simples — recarrega só ao reabrir após mudança
    setReposicaoLoading(true)
    try {
      const r = await fetch("/api/financeiro/reposicao/detalhes", { cache: "no-store" })
      const j = (await r.json()) as ReposicaoDetalhes | { error: string }
      if (!("error" in j)) setReposicaoDetalhes(j)
    } finally {
      setReposicaoLoading(false)
    }
  }

  const handleLancarReposicao = async (amount: number, description: string, date: string) => {
    const r = await fetch("/api/financeiro/reposicao/lancar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, description, date }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      throw new Error(j?.error || "Falha ao registrar reposição")
    }
    // Invalida cache do drilldown e recarrega painel pra refletir saldo novo.
    setReposicaoDetalhes(null)
    await load()
  }

  // ---------- Derivações por modo ----------

  // MP — sempre estado atual (snapshot é geral por natureza). Nos dois modos
  // mostramos a mesma fonte: liberado total, a liberar (unavailable balance) e retido.
  // Em modo "Mês" adicionamos o que foi liberado no mês corrente.
  const mpConfigured = mp?.configured === true
  const mpReleasedTotal = mp?.releasedTotal ?? 0
  const mpUnavailable = mp?.unavailableBalance ?? 0
  const mpDisputed = mp?.disputedTotal ?? 0
  const mpDisputedCount = mp?.disputedCount ?? 0
  const mpReleasedMes = pro?.mpReleasedNoMes ?? 0

  // Reposição
  const reposicaoPendenteMes = pro?.pendenteReposicao ?? 0
  // Lifetime: CMV vendido lifetime − reposição paga lifetime. É o saldo "real"
  // de mercadoria pendente de reposição pela operação.
  const reporMercadoriaLifetime = cashLifetime ? Math.max(0, cashLifetime.caixaReposicao) : 0
  // Aporte do sócio pendente − amortizado: dimensão paralela (dívida com sócio).
  const devoAosSocios = pro?.aportesADevolver.total ?? 0
  const amortizacaoSugerida = pro?.aportesADevolver.amortizacaoSugerida ?? 0

  // Lucro — vem do DRE oficial (lib/dre.ts), não da fórmula de caixa do
  // pro-labore route. Mesma fonte que /admin/financeiro/relatorios/dre e
  // /admin/financeiro/relatorios/dre-anual usam, então os números batem.
  const currentMonth0 = useMemo(() => new Date().getMonth(), [])
  const lucroMes = dreAnual?.months[currentMonth0]?.dre.lucroLiquido ?? 0
  const lucroYTD = dreAnual?.total.lucroLiquido ?? 0

  // Pró-labore disponível — calculado a partir do LUCRO DRE (mesma fonte
  // do card Lucro). Garante que os 2 cards têm a mesma base.
  // Mês:  (lucro DRE do mês − pagamentos pra sócio no mês) × pct
  // YTD:  (lucro DRE acumulado − pagamentos pra sócio YTD)   × pct
  const proLaborePct = pro?.proLaborePct ?? 100
  const saidasMes = pro?.saidasParaSocioMes ?? 0
  const saidasYTD = pro?.saidasParaSocioYTD ?? 0
  const proLaboreMes = Math.max(0, (lucroMes - saidasMes) * proLaborePct / 100)
  const proLaboreGeral = Math.max(0, (lucroYTD - saidasYTD) * proLaborePct / 100)


  // Decide o "valor disponível pra retirar"
  const disponivelRetirar = mode === "mes" ? proLaboreMes : proLaboreGeral

  // ---------- Alertas ----------

  const alertas: Array<{ tone: "warn" | "info" | "ok"; text: string; href?: string }> = []
  if (pro?.contasAPagarDoMes.vencendo7d) {
    alertas.push({
      tone: "warn",
      text: `${pro.contasAPagarDoMes.vencendo7d} conta(s) vencendo nos próximos 7 dias (${formatCurrency(pro.contasAPagarDoMes.total)})`,
      href: "/admin/financeiro/contas?tab=payable",
    })
  }
  if (mpDisputedCount > 0) {
    alertas.push({
      tone: "warn",
      text: `${mpDisputedCount} reclamação(ões) no Mercado Pago retendo ${formatCurrency(mpDisputed)}`,
      href: "/admin/financeiro/devolucoes",
    })
  }
  if (pro?.billsCorrespondentesSemCusto && pro.billsCorrespondentesSemCusto > 0) {
    alertas.push({
      tone: "info",
      text: `${pro.billsCorrespondentesSemCusto} venda(s) liberada(s) este mês sem custo cadastrado — caixa de reposição pode estar subestimado`,
      href: "/admin/produtos/anuncios",
    })
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      <PageHeader
        title="📊 Painel"
        description="Visão direta: o que recebi, o que repor, lucro, retirada e aportes."
        actions={
          <div className="inline-flex rounded-lg border border-border bg-background p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("geral")}
              className={`px-3 py-1.5 rounded-md transition ${mode === "geral" ? "bg-primary-600 text-white" : "text-muted-foreground hover:bg-accent"}`}
            >
              Geral
            </button>
            <button
              type="button"
              onClick={() => setMode("mes")}
              className={`px-3 py-1.5 rounded-md transition ${mode === "mes" ? "bg-primary-600 text-white" : "text-muted-foreground hover:bg-accent"}`}
            >
              Mês atual
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !pro ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-5">
                <div className="h-24 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {alertas.length > 0 && (
            <Card>
              <CardContent className="pt-4 pb-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                  Alertas
                </p>
                {alertas.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-sm ${
                      a.tone === "warn"
                        ? "text-amber-700"
                        : a.tone === "ok"
                          ? "text-emerald-700"
                          : "text-sky-700"
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      {a.text}
                      {a.href && (
                        <Link
                          href={a.href}
                          className="ml-2 inline-flex items-center gap-1 text-xs font-semibold underline"
                        >
                          ver <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card 1 — Mercado Pago */}
            <MetricCard
              icon={<Wallet className="w-5 h-5" />}
              iconColor="bg-emerald-50 text-emerald-700"
              title="Mercado Pago"
              tooltip="Saldo liberado pelo MP. Mês: liberado neste mês. Geral: total histórico liberado."
            >
              {!mpConfigured ? (
                <div className="text-sm">
                  <p className="text-muted-foreground">Mercado Pago não conectado.</p>
                  <Link
                    href="/admin/configuracoes"
                    className="text-primary-600 text-xs font-semibold inline-flex items-center gap-1"
                  >
                    Conectar agora <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : (
                <>
                  <PrimaryValue value={mode === "mes" ? mpReleasedMes : mpReleasedTotal} />
                  <StatsGrid
                    items={[
                      { label: "A liberar", value: formatCurrency(mpUnavailable) },
                      { label: "Retido", value: formatCurrency(mpDisputed), tone: "amber" },
                    ]}
                  />
                  <CardFooter
                    primary={
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={refreshMP}
                          disabled={refreshing}
                          className="inline-flex items-center gap-1 text-xs text-primary-600 font-semibold hover:underline disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                          {refreshing ? "Atualizando..." : "Atualizar"}
                        </button>
                        <Link
                          href="/admin/financeiro/mercado-pago"
                          className="inline-flex items-center gap-1 text-xs text-primary-600 font-semibold hover:underline"
                        >
                          Ver detalhes <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    }
                    secondary={`Há ${relativeTime(mp?.cachedSyncedAt).replace("há ", "")}`}
                  />
                </>
              )}
            </MetricCard>

            {/* Card 2 — Reposição */}
            <MetricCard
              icon={<Package className="w-5 h-5" />}
              iconColor="bg-rose-50 text-rose-700"
              title="Reposição de mercadoria"
              tooltip="Custo de mercadoria vendida que ainda não foi reposta pela operação."
            >
              <button
                type="button"
                onClick={openReposicao}
                className="text-left group"
                aria-label="Ver detalhes mensais"
              >
                <PrimaryValue
                  value={mode === "mes" ? reposicaoPendenteMes : reporMercadoriaLifetime}
                />
              </button>
              <CardFooter
                primary={
                  <Button
                    size="sm"
                    onClick={() => setShowLancarReposicao(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Lançar reposição
                  </Button>
                }
                secondary={
                  <button
                    type="button"
                    onClick={openReposicao}
                    className="text-primary-600 hover:underline inline-flex items-center gap-1"
                  >
                    Ver detalhes <ArrowRight className="w-3 h-3" />
                  </button>
                }
              />
            </MetricCard>

            {/* Card 3 — Lucro */}
            <MetricCard
              icon={<TrendingUp className="w-5 h-5" />}
              iconColor="bg-primary-50 text-primary-700"
              title={mode === "mes" ? "Lucro do mês" : "Lucro acumulado"}
              tooltip="Lucro líquido do DRE — receita bruta menos taxas, custo de mercadoria, despesas e pró-labore retirado."
            >
              <PrimaryValue value={mode === "mes" ? lucroMes : lucroYTD} negative />
              <CardFooter
                primary={
                  <Link
                    href={mode === "mes" ? "/admin/financeiro/relatorios/dre" : "/admin/financeiro/relatorios/dre-anual"}
                    className="text-xs text-primary-600 font-semibold inline-flex items-center gap-1 hover:underline"
                  >
                    Ver DRE {mode === "mes" ? "mensal" : "anual"} <ArrowRight className="w-3 h-3" />
                  </Link>
                }
              />
            </MetricCard>

            {/* Card 4 — Pró-labore disponível */}
            <MetricCard
              icon={<HandCoins className="w-5 h-5" />}
              iconColor="bg-violet-50 text-violet-700"
              title="Pró-labore disponível"
              tooltip={
                pro
                  ? `Lucro × ${pro.proLaborePct}% menos pagamentos pra sócio no período. Clique 'Ajustar %' pra mudar.`
                  : "Quanto você pode retirar de pró-labore."
              }
            >
              <PrimaryValue value={disponivelRetirar} />
              {pro && (
                <StatsGrid
                  items={[
                    {
                      label: "Lucro",
                      value: formatCurrency(mode === "mes" ? lucroMes : lucroYTD),
                    },
                    ...((mode === "mes" ? pro.saidasParaSocioMes : pro.saidasParaSocioYTD) > 0
                      ? [
                          {
                            label: "Pagamentos sócio",
                            value: formatCurrency(
                              mode === "mes"
                                ? pro.saidasParaSocioMes
                                : pro.saidasParaSocioYTD,
                            ),
                            tone: "amber" as const,
                          },
                        ]
                      : []),
                  ]}
                />
              )}
              <CardFooter
                primary={
                  <Button
                    size="sm"
                    onClick={() => setShowRetirar(true)}
                    disabled={disponivelRetirar <= 0}
                  >
                    Retirar
                  </Button>
                }
                secondary={
                  <button
                    type="button"
                    onClick={() => setShowConfigPct(true)}
                    className="text-primary-600 hover:underline"
                  >
                    Ajustar % ({pro?.proLaborePct ?? 100}%)
                  </button>
                }
              />
            </MetricCard>

            {/* Card 5 — Aporte pendente */}
            <MetricCard
              icon={<Users className="w-5 h-5" />}
              iconColor="bg-amber-50 text-amber-700"
              title="Aporte pendente"
              tooltip="Capital injetado pelo sócio ainda a devolver. Sugerido = saldo / 24 meses."
            >
              <PrimaryValue value={devoAosSocios} />
              {devoAosSocios > 0 && amortizacaoSugerida > 0 && (
                <StatsGrid
                  items={[
                    {
                      label: "Sugerido/mês",
                      value: formatCurrency(amortizacaoSugerida),
                    },
                    { label: "Meta", value: "24 meses" },
                  ]}
                />
              )}
              <CardFooter
                primary={
                  <Link
                    href="/admin/financeiro/aportes"
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition"
                  >
                    Gerenciar <ArrowRight className="w-4 h-4" />
                  </Link>
                }
              />
            </MetricCard>
          </div>

          {pro?.cmvFaltando && (
            <Card>
              <CardContent className="pt-4 pb-4 flex items-start gap-3 text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Custos de mercadoria não cadastrados</p>
                  <p className="text-muted-foreground">
                    Algumas vendas foram registradas sem custo do produto. O lucro e a reposição podem estar subestimados.
                  </p>
                  <Link
                    href="/admin/produtos/anuncios"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
                  >
                    Cadastrar custos <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Fechar"
                  onClick={() => {
                    /* noop — alerta volta a aparecer no próximo refresh se persistir */
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <RetirarModal
        open={showRetirar}
        onClose={() => setShowRetirar(false)}
        disponivel={disponivelRetirar}
        onConfirm={handleRetirar}
      />

      <ReposicaoDetalhesModal
        open={showReposicao}
        onClose={() => setShowReposicao(false)}
        data={reposicaoDetalhes}
        loading={reposicaoLoading}
      />

      <LancarReposicaoModal
        open={showLancarReposicao}
        onClose={() => setShowLancarReposicao(false)}
        onConfirm={handleLancarReposicao}
      />

      <ConfigPctModal
        open={showConfigPct}
        onClose={() => setShowConfigPct(false)}
        currentPct={pro?.proLaborePct ?? 100}
        onConfirm={handleConfigPct}
      />
    </div>
    </TooltipProvider>
  )
}
