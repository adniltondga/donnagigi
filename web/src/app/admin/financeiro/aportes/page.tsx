"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Plus,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  RotateCcw,
  ArrowLeft,
  FolderTree,
  X,
  Check,
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
import { formatCurrency } from "@/lib/calculations"

interface Subcategoria {
  id: string
  name: string
}

interface Aporte {
  id: string
  amount: number
  status: string
  dueDate: string
  paidDate: string | null
  description: string
  notes: string | null
  billCategoryId: string | null
  billCategoryName: string | null
}

interface LegacyAmortizacao {
  id: string
  amount: number
  status: string
  paidDate: string | null
  description: string
  notes: string | null
  migrated: boolean
}

interface ListarResp {
  configured: boolean
  amortizacaoSubId: string | null
  subcategorias: Subcategoria[]
  aportes: Aporte[]
  legacyAmortizacoes: LegacyAmortizacao[]
  totals: {
    pendingTotal: number
    pendingCount: number
    paidTotal: number
    paidCount: number
    legacyAmortizacaoNaoMigradaTotal?: number
    saldoDevedor: number
  }
}

interface MigrationItem {
  type: "mark_paid" | "split_and_pay"
  aporteId: string
  aporteAmount: number
  amortizacaoIds: string[]
  paidAmount: number
  remainingAmount: number
  paidDate: string
}

interface MigrationPlan {
  amortizacoesLegacy: number
  amortizacoesLegacyTotal: number
  aportesPendingAntes: number
  aportesPendingAntesTotal: number
  itens: MigrationItem[]
  amortizacoesNaoUsadasTotal: number
  saldoAposMigracao: number
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("pt-BR")
}

// ---------- Modais ----------

function LancarAporteModal({
  open,
  onClose,
  subcategorias,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  subcategorias: Subcategoria[]
  onConfirm: (data: {
    amount: number
    billCategoryId: string
    description: string
    date: string
  }) => Promise<void>
}) {
  const [amount, setAmount] = useState("")
  const [billCategoryId, setBillCategoryId] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(todayISO())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount("")
      setBillCategoryId("")
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
    if (!billCategoryId) {
      setError("Escolha uma categoria")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm({ amount: n, billCategoryId, description, date })
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
          <DialogTitle>Lançar aporte do sócio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="ap-amount">Valor (R$)</Label>
            <Input
              id="ap-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ap-cat">Categoria</Label>
            <select
              id="ap-cat"
              value={billCategoryId}
              onChange={(e) => setBillCategoryId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Escolha uma categoria...</option>
              {subcategorias.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ap-desc">Descrição (opcional)</Label>
            <Input
              id="ap-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Aporte do sócio"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ap-date">Data do aporte</Label>
            <Input
              id="ap-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Lançado como dívida com o sócio (passivo). Não entra no DRE — não é despesa operacional.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Registrando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PagarAporteModal({
  open,
  onClose,
  aporte,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  aporte: Aporte | null
  onConfirm: (data: { date: string; valorPago?: number }) => Promise<void>
}) {
  const [date, setDate] = useState(todayISO())
  const [valorPago, setValorPago] = useState("")
  const [parcial, setParcial] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDate(todayISO())
      setValorPago("")
      setParcial(false)
      setError(null)
    }
  }, [open])

  if (!aporte) return null

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      if (parcial) {
        const n = Number(valorPago.replace(",", "."))
        if (!Number.isFinite(n) || n <= 0 || n >= aporte.amount) {
          setError(`Valor parcial deve ser entre 0 e ${formatCurrency(aporte.amount)}`)
          setSubmitting(false)
          return
        }
        await onConfirm({ date, valorPago: n })
      } else {
        await onConfirm({ date })
      }
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
          <DialogTitle>Pagar aporte</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-lg bg-muted p-3 text-sm space-y-0.5">
            <p>
              <b>{aporte.description}</b>
            </p>
            <p className="text-muted-foreground">
              {aporte.billCategoryName} · valor: {formatCurrency(aporte.amount)} ·
              recebido em {fmtDate(aporte.dueDate)}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pay-date">Data do pagamento</Label>
            <Input
              id="pay-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={parcial}
              onChange={(e) => setParcial(e.target.checked)}
              className="mt-1"
            />
            <span>
              <b>Pagar só parte</b> do aporte. O resto fica como aporte separado pendente.
            </span>
          </label>
          {parcial && (
            <div className="space-y-1">
              <Label htmlFor="pay-amount">Valor pago (parcial)</Label>
              <Input
                id="pay-amount"
                type="text"
                inputMode="decimal"
                value={valorPago}
                onChange={(e) => setValorPago(e.target.value)}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Saldo restante {valorPago ? `(R$ ${(aporte.amount - Number(valorPago.replace(",", ".") || "0")).toFixed(2)})` : ""} fica como aporte pendente novo.
              </p>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Registrando..." : parcial ? "Pagar parcial" : "Marcar como pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditarAporteModal({
  open,
  onClose,
  aporte,
  subcategorias,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  aporte: Aporte | null
  subcategorias: Subcategoria[]
  onConfirm: (data: {
    amount: number
    billCategoryId: string
    description: string
    date: string
  }) => Promise<void>
}) {
  const [amount, setAmount] = useState("")
  const [billCategoryId, setBillCategoryId] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(todayISO())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && aporte) {
      setAmount(aporte.amount.toFixed(2))
      setBillCategoryId(aporte.billCategoryId ?? "")
      setDescription(aporte.description)
      setDate(aporte.dueDate.slice(0, 10))
      setError(null)
    }
  }, [open, aporte])

  if (!aporte) return null

  const submit = async () => {
    const n = Number(amount.replace(",", "."))
    if (!Number.isFinite(n) || n <= 0) {
      setError("Valor inválido")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm({ amount: n, billCategoryId, description, date })
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
          <DialogTitle>Editar aporte</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="ed-amount">Valor (R$)</Label>
            <Input
              id="ed-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-cat">Categoria</Label>
            <select
              id="ed-cat"
              value={billCategoryId}
              onChange={(e) => setBillCategoryId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Escolha uma categoria...</option>
              {subcategorias.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-desc">Descrição</Label>
            <Input
              id="ed-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-date">Data do aporte</Label>
            <Input
              id="ed-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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

function GerenciarCategoriasModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  onChanged: () => void
}) {
  interface NodeRaw {
    id: string
    name: string
    parentId: string | null
    children?: NodeRaw[]
    _count?: { bills: number; children: number }
  }
  interface Sub {
    id: string
    name: string
    billsCount: number
  }
  const [rootId, setRootId] = useState<string | null>(null)
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(false)
  const [novoNome, setNovoNome] = useState("")
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch("/api/bill-categories?type=payable", { cache: "no-store" })
      const j = (await r.json()) as { categories?: NodeRaw[] }
      const aporteRoot = (j.categories ?? []).find(
        (c) => c.parentId === null && c.name === "Aporte sócio",
      )
      if (!aporteRoot) {
        setRootId(null)
        setSubs([])
        setError("Categoria raiz 'Aporte sócio' não existe.")
        return
      }
      setRootId(aporteRoot.id)
      const filhas = (aporteRoot.children ?? [])
        .filter((c) => c.name !== "Amortização")
        .map((c) => ({
          id: c.id,
          name: c.name,
          billsCount: c._count?.bills ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
      setSubs(filhas)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setNovoNome("")
      setEditingId(null)
      setEditDraft("")
      void load()
    }
  }, [open, load])

  const criar = async () => {
    const nome = novoNome.trim()
    if (!nome || !rootId) return
    setCreating(true)
    setError(null)
    try {
      const r = await fetch("/api/bill-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nome, type: "payable", parentId: rootId }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setError(j?.error || "Erro ao criar")
        return
      }
      setNovoNome("")
      await load()
      onChanged()
    } finally {
      setCreating(false)
    }
  }

  const renomear = async (id: string) => {
    const nome = editDraft.trim()
    if (!nome) {
      setEditingId(null)
      return
    }
    setError(null)
    const r = await fetch(`/api/bill-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nome }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setError(j?.error || "Erro ao renomear")
      return
    }
    setEditingId(null)
    setEditDraft("")
    await load()
    onChanged()
  }

  const excluir = async (sub: Sub) => {
    if (sub.billsCount > 0) {
      setError(
        `Não dá pra excluir '${sub.name}' — tem ${sub.billsCount} lançamento(s) vinculado(s).`,
      )
      return
    }
    if (!confirm(`Excluir a categoria '${sub.name}'?`)) return
    setError(null)
    const r = await fetch(`/api/bill-categories/${sub.id}`, { method: "DELETE" })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setError(j?.error || "Erro ao excluir")
      return
    }
    await load()
    onChanged()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Categorias de aporte</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            Subcategorias usadas ao lançar um aporte. A subcategoria
            &ldquo;Amortização&rdquo; é interna e não aparece aqui.
          </p>

          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : !rootId ? (
            <div className="py-6 text-sm text-amber-700">{error ?? "Categoria não encontrada."}</div>
          ) : (
            <>
              <div className="space-y-1">
                {subs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">
                    Nenhuma subcategoria. Crie a primeira abaixo.
                  </p>
                ) : (
                  subs.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-accent/30"
                    >
                      {editingId === s.id ? (
                        <>
                          <Input
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void renomear(s.id)
                              if (e.key === "Escape") setEditingId(null)
                            }}
                            autoFocus
                            className="h-8"
                          />
                          <button
                            type="button"
                            onClick={() => void renomear(s.id)}
                            className="text-emerald-600 p-1"
                            title="Salvar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-muted-foreground p-1"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm">{s.name}</span>
                          {s.billsCount > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {s.billsCount} lanç.
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(s.id)
                              setEditDraft(s.name)
                            }}
                            className="text-muted-foreground hover:text-foreground p-1"
                            title="Renomear"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void excluir(s)}
                            className="text-red-600 hover:text-red-700 p-1"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <Input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void criar()
                  }}
                  placeholder="Nome da nova categoria"
                  className="h-9"
                />
                <Button onClick={criar} disabled={!novoNome.trim() || creating} size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Criar
                </Button>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MigracaoModal({
  open,
  onClose,
  plan,
  loading,
  onApply,
}: {
  open: boolean
  onClose: () => void
  plan: MigrationPlan | null
  loading: boolean
  onApply: () => Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apply = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onApply()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao aplicar migração")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Consolidar amortizações antigas</DialogTitle>
        </DialogHeader>
        {loading && !plan ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Calculando preview...</div>
        ) : !plan || plan.itens.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground">
            Nada a migrar — sem amortizações legadas pendentes.
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p>
                <b>Antes:</b> {plan.aportesPendingAntes} aporte(s) pendentes ={" "}
                {formatCurrency(plan.aportesPendingAntesTotal)}
              </p>
              <p>
                <b>Amortizações legacy a consolidar:</b> {plan.amortizacoesLegacy} ={" "}
                {formatCurrency(plan.amortizacoesLegacyTotal)}
              </p>
              <p>
                <b>Saldo após:</b> {formatCurrency(plan.saldoAposMigracao)}
              </p>
              {plan.amortizacoesNaoUsadasTotal > 0 && (
                <p className="text-amber-700">
                  <b>Atenção:</b> {formatCurrency(plan.amortizacoesNaoUsadasTotal)} de
                  amortização não casa com nenhum aporte (pode haver inconsistência).
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Ações que serão executadas (FIFO):
            </p>
            <div className="rounded-lg border border-border max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="text-left py-1.5 px-2">Tipo</th>
                    <th className="text-right py-1.5 px-2">Aporte (R$)</th>
                    <th className="text-right py-1.5 px-2">Pago (R$)</th>
                    <th className="text-right py-1.5 px-2">Restante (R$)</th>
                    <th className="text-left py-1.5 px-2">Data pgto</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.itens.map((it, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 px-2">
                        {it.type === "mark_paid" ? "Marcar pago" : "Split + pagar"}
                      </td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(it.aporteAmount)}</td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(it.paidAmount)}</td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(it.remainingAmount)}</td>
                      <td className="py-1.5 px-2">{fmtDate(it.paidDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              <b>Importante:</b> nenhuma amortização será deletada. Elas serão marcadas com
              prefix [migrated] em notes — saem do cálculo de saldo. Após validar que tudo
              ficou certo, você pode rodar &ldquo;Limpar legadas&rdquo; pra remover de vez.
            </p>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Fechar
          </Button>
          {plan && plan.itens.length > 0 && (
            <Button onClick={apply} disabled={submitting}>
              {submitting ? "Aplicando..." : "Aplicar migração"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Page ----------

export default function AportesPage() {
  const [data, setData] = useState<ListarResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("pending")

  const [showLancar, setShowLancar] = useState(false)
  const [showPagar, setShowPagar] = useState(false)
  const [showEditar, setShowEditar] = useState(false)
  const [showCategorias, setShowCategorias] = useState(false)
  const [showMigracao, setShowMigracao] = useState(false)
  const [migracaoPlan, setMigracaoPlan] = useState<MigrationPlan | null>(null)
  const [migracaoLoading, setMigracaoLoading] = useState(false)
  const [showLegacy, setShowLegacy] = useState(false)
  const [aporteAlvo, setAporteAlvo] = useState<Aporte | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch("/api/financeiro/aportes/listar", { cache: "no-store" })
      const j = (await r.json()) as ListarResp | { error: string }
      if ("error" in j) throw new Error(j.error)
      setData(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openMigracao = async () => {
    setShowMigracao(true)
    setMigracaoLoading(true)
    try {
      const r = await fetch("/api/financeiro/aportes/migrar", { cache: "no-store" })
      const j = (await r.json()) as MigrationPlan | { error: string }
      if (!("error" in j)) setMigracaoPlan(j)
    } finally {
      setMigracaoLoading(false)
    }
  }

  const aplicarMigracao = async () => {
    const r = await fetch("/api/financeiro/aportes/migrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply" }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      throw new Error(j?.error || "Falha")
    }
    setMigracaoPlan(null)
    await load()
  }

  const limparLegacy = async () => {
    if (!confirm("Deletar todas as amortizações legadas marcadas como [migrated]? Esta ação é irreversível.")) {
      return
    }
    const r = await fetch("/api/financeiro/aportes/migrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cleanup" }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert(j?.error || "Falha ao limpar")
      return
    }
    await load()
  }

  const lancarAporte = async (d: {
    amount: number
    billCategoryId: string
    description: string
    date: string
  }) => {
    const r = await fetch("/api/financeiro/aportes/lancar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      throw new Error(j?.error || "Falha")
    }
    await load()
  }

  const pagarAporte = async (id: string, payload: { date: string; valorPago?: number }) => {
    const action = payload.valorPago !== undefined ? "split" : "pagar"
    const body =
      action === "split"
        ? { action, valorPago: payload.valorPago, date: payload.date }
        : { action, date: payload.date }
    const r = await fetch(`/api/financeiro/aportes/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      throw new Error(j?.error || "Falha")
    }
    await load()
  }

  const editarAporte = async (id: string, d: {
    amount: number
    billCategoryId: string
    description: string
    date: string
  }) => {
    const r = await fetch(`/api/financeiro/aportes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      throw new Error(j?.error || "Falha")
    }
    await load()
  }

  const reabrirAporte = async (id: string) => {
    if (!confirm("Reabrir esse aporte (marcar como pendente)?")) return
    const r = await fetch(`/api/financeiro/aportes/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reabrir" }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert(j?.error || "Falha")
      return
    }
    await load()
  }

  const excluirAporte = async (id: string) => {
    if (!confirm("Excluir esse aporte? Esta ação é irreversível.")) return
    const r = await fetch(`/api/financeiro/aportes/${id}`, { method: "DELETE" })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert(j?.error || "Falha")
      return
    }
    await load()
  }

  const aportesFiltered =
    data?.aportes.filter((a) => {
      if (statusFilter === "all") return true
      return a.status === statusFilter
    }) ?? []

  const legacyNaoMigradaCount =
    data?.legacyAmortizacoes.filter((a) => !a.migrated).length ?? 0
  const legacyMigradaCount =
    data?.legacyAmortizacoes.filter((a) => a.migrated).length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="🤝 Aportes do sócio"
        description="Capital injetado pelo sócio (passivo). Pague individualmente cada aporte conforme tiver caixa."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/financeiro/painel"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Painel
            </Link>
            <Button
              variant="outline"
              onClick={() => setShowCategorias(true)}
              disabled={!data?.configured}
            >
              <FolderTree className="w-4 h-4 mr-1" />
              Categorias
            </Button>
            <Button onClick={() => setShowLancar(true)} disabled={!data?.configured}>
              <Plus className="w-4 h-4 mr-1" />
              Lançar aporte
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !data ? (
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="h-24 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      ) : !data?.configured ? (
        <Card>
          <CardContent className="pt-5 pb-5 text-sm text-muted-foreground">
            Categoria &ldquo;Aporte sócio&rdquo; não configurada. Crie em Contas → Categorias.
          </CardContent>
        </Card>
      ) : (
        <>
          {legacyNaoMigradaCount > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4 pb-4 flex items-start gap-3 text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-900">
                    Migração disponível: {legacyNaoMigradaCount} amortização(ões) legada(s)
                  </p>
                  <p className="text-amber-800">
                    Você tem amortizações no modelo antigo que ainda não foram consolidadas.
                    Revise o preview e aplique pra limpar a base.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={openMigracao}>
                  Revisar migração
                </Button>
              </CardContent>
            </Card>
          )}

          {legacyMigradaCount > 0 && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="pt-4 pb-4 flex items-start gap-3 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-emerald-900">
                    {legacyMigradaCount} amortização(ões) já consolidada(s)
                  </p>
                  <p className="text-emerald-800">
                    Quando tudo estiver conferido, você pode deletar essas linhas legadas pra limpar a base.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={limparLegacy}>
                  Limpar legadas
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="text-xl font-bold">{formatCurrency(data.totals.pendingTotal)}</p>
                <p className="text-xs text-muted-foreground">{data.totals.pendingCount} aporte(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Já pago</p>
                <p className="text-xl font-bold">{formatCurrency(data.totals.paidTotal)}</p>
                <p className="text-xs text-muted-foreground">{data.totals.paidCount} aporte(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Saldo a devolver</p>
                <p className="text-xl font-bold">{formatCurrency(data.totals.saldoDevedor)}</p>
                {(data.totals.legacyAmortizacaoNaoMigradaTotal ?? 0) > 0 && (
                  <p className="text-xs text-amber-700">
                    inclui −{formatCurrency(data.totals.legacyAmortizacaoNaoMigradaTotal ?? 0)} de amortizações legadas
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Aportes</p>
                <div className="inline-flex rounded-lg border border-border p-1 text-xs">
                  {(["pending", "paid", "all"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 rounded ${statusFilter === s ? "bg-primary-600 text-white" : "text-muted-foreground hover:bg-accent"}`}
                    >
                      {s === "pending" ? "Pendentes" : s === "paid" ? "Pagos" : "Todos"}
                    </button>
                  ))}
                </div>
              </div>

              {aportesFiltered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum aporte {statusFilter === "all" ? "" : statusFilter === "pending" ? "pendente" : "pago"}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border">
                        <th className="text-left py-2 px-2">Data</th>
                        <th className="text-left py-2 px-2">Categoria</th>
                        <th className="text-right py-2 px-2">Valor</th>
                        <th className="text-left py-2 px-2">Descrição</th>
                        <th className="text-left py-2 px-2">Status</th>
                        <th className="text-right py-2 px-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aportesFiltered.map((a) => (
                        <tr key={a.id} className="border-b border-border/50 hover:bg-accent/30">
                          <td className="py-2 px-2">{fmtDate(a.dueDate)}</td>
                          <td className="py-2 px-2">{a.billCategoryName ?? "—"}</td>
                          <td className="py-2 px-2 text-right font-semibold">
                            {formatCurrency(a.amount)}
                          </td>
                          <td className="py-2 px-2">{a.description}</td>
                          <td className="py-2 px-2">
                            {a.status === "paid" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" /> Pago em {fmtDate(a.paidDate)}
                              </span>
                            ) : (
                              <span className="text-amber-700">Pendente</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <div className="inline-flex gap-1">
                              {a.status === "pending" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setAporteAlvo(a)
                                    setShowPagar(true)
                                  }}
                                >
                                  Pagar
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => reabrirAporte(a.id)}
                                  title="Reabrir (marcar como pendente)"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAporteAlvo(a)
                                  setShowEditar(true)
                                }}
                                title="Editar"
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => excluirAporte(a.id)}
                                title="Excluir"
                              >
                                <Trash2 className="w-3 h-3 text-red-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {data.legacyAmortizacoes.length > 0 && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <button
                  type="button"
                  onClick={() => setShowLegacy((v) => !v)}
                  className="text-sm font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  {showLegacy ? "Ocultar" : "Ver"} amortizações legadas (modelo antigo)
                </button>
                {showLegacy && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left py-1.5 px-2">Data</th>
                          <th className="text-right py-1.5 px-2">Valor</th>
                          <th className="text-left py-1.5 px-2">Descrição</th>
                          <th className="text-left py-1.5 px-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.legacyAmortizacoes.map((a) => (
                          <tr key={a.id} className="border-b border-border/50">
                            <td className="py-1.5 px-2">{fmtDate(a.paidDate)}</td>
                            <td className="py-1.5 px-2 text-right">{formatCurrency(a.amount)}</td>
                            <td className="py-1.5 px-2">{a.description}</td>
                            <td className="py-1.5 px-2">
                              {a.migrated ? (
                                <span className="text-emerald-700">migrada</span>
                              ) : (
                                <span className="text-amber-700">não migrada</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <LancarAporteModal
        open={showLancar}
        onClose={() => setShowLancar(false)}
        subcategorias={data?.subcategorias ?? []}
        onConfirm={lancarAporte}
      />

      <PagarAporteModal
        open={showPagar}
        onClose={() => {
          setShowPagar(false)
          setAporteAlvo(null)
        }}
        aporte={aporteAlvo}
        onConfirm={async (d) => {
          if (aporteAlvo) await pagarAporte(aporteAlvo.id, d)
        }}
      />

      <EditarAporteModal
        open={showEditar}
        onClose={() => {
          setShowEditar(false)
          setAporteAlvo(null)
        }}
        aporte={aporteAlvo}
        subcategorias={data?.subcategorias ?? []}
        onConfirm={async (d) => {
          if (aporteAlvo) await editarAporte(aporteAlvo.id, d)
        }}
      />

      <MigracaoModal
        open={showMigracao}
        onClose={() => setShowMigracao(false)}
        plan={migracaoPlan}
        loading={migracaoLoading}
        onApply={aplicarMigracao}
      />

      <GerenciarCategoriasModal
        open={showCategorias}
        onClose={() => setShowCategorias(false)}
        onChanged={load}
      />
    </div>
  )
}
