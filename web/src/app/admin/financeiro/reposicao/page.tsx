"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Search,
  ChevronLeft,
  ChevronRight,
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
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { formatCurrency } from "@/lib/calculations"

interface Reposicao {
  id: string
  amount: number
  description: string
  paidDate: string | null
  dueDate: string
}

interface ListResp {
  page: number
  pageSize: number
  total: number
  totalPages: number
  items: Reposicao[]
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

function ymToISO(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ---------- Modal de lançar/editar ----------

function ReposicaoFormModal({
  open,
  onClose,
  editing,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  editing: Reposicao | null
  onConfirm: (data: { amount: number; description: string; date: string }) => Promise<void>
}) {
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(todayISO())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      if (editing) {
        setAmount(editing.amount.toString().replace(".", ","))
        setDescription(editing.description ?? "")
        setDate(ymToISO(editing.paidDate) || todayISO())
      } else {
        setAmount("")
        setDescription("")
        setDate(todayISO())
      }
      setError(null)
    }
  }, [open, editing])

  const submit = async () => {
    const n = Number(amount.replace(",", "."))
    if (!Number.isFinite(n) || n <= 0) {
      setError("Valor inválido")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm({ amount: n, description: description.trim(), date })
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
          <DialogTitle>
            {editing ? "Editar reposição" : "Registrar reposição de mercadoria"}
          </DialogTitle>
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
          {!editing && (
            <p className="text-xs text-muted-foreground">
              Lançado como compra de mercadoria já paga. Abate do saldo a repor —
              não entra como despesa no DRE pra não duplicar com o CMV.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Salvando..." : editing ? "Salvar" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Página ----------

export default function ReposicaoPage() {
  const [data, setData] = useState<ListResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [ymFilter, setYmFilter] = useState("")
  const [q, setQ] = useState("")
  const [qDebounced, setQDebounced] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Reposicao | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", "20")
      if (ymFilter) params.set("ym", ymFilter)
      if (qDebounced) params.set("q", qDebounced)
      const res = await fetch(`/api/financeiro/reposicao/list?${params}`, {
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Erro ao carregar")
      const j: ListResp = await res.json()
      setData(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro")
    } finally {
      setLoading(false)
    }
  }, [page, ymFilter, qDebounced])

  useEffect(() => {
    load()
  }, [load])

  // Debounce simples da busca
  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced(q.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const handleSave = async (form: {
    amount: number
    description: string
    date: string
  }) => {
    if (editing) {
      const res = await fetch(`/api/financeiro/reposicao/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || "Erro ao salvar")
      }
    } else {
      const res = await fetch("/api/financeiro/reposicao/lancar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || "Erro ao lançar")
      }
    }
    await load()
  }

  const handleDelete = async (r: Reposicao) => {
    const ok = await confirmDialog({
      title: "Excluir reposição?",
      description: `${r.description} — ${formatCurrency(r.amount)} (${fmtDate(r.paidDate)})`,
      confirmLabel: "Excluir",
      variant: "danger",
    })
    if (!ok) return
    const res = await fetch(`/api/financeiro/reposicao/${r.id}`, { method: "DELETE" })
    if (res.ok) await load()
    else setError("Erro ao excluir")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="📦 Reposição de mercadoria"
        description="Cada linha é uma compra de produto pra revender. Abate do saldo a repor — não entra como despesa no DRE."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/financeiro/painel"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Painel
            </Link>
            <Button
              onClick={() => {
                setEditing(null)
                setShowForm(true)
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Nova reposição
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-4 pb-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="filter-q">Buscar por descrição</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="filter-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ex: capa, película..."
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="filter-ym">Mês</Label>
            <Input
              id="filter-ym"
              type="month"
              value={ymFilter}
              onChange={(e) => {
                setYmFilter(e.target.value)
                setPage(1)
              }}
            />
          </div>
          {(ymFilter || q) && (
            <Button
              variant="outline"
              onClick={() => {
                setYmFilter("")
                setQ("")
                setPage(1)
              }}
            >
              Limpar
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4">
          {loading && !data ? (
            <div className="h-24 bg-muted animate-pulse rounded" />
          ) : !data || data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {ymFilter || qDebounced
                ? "Nenhuma reposição encontrada com esses filtros."
                : "Nenhuma reposição registrada ainda."}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left py-2 px-2">Data</th>
                      <th className="text-left py-2 px-2">Descrição</th>
                      <th className="text-right py-2 px-2">Valor</th>
                      <th className="text-right py-2 px-2 w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-border/50 hover:bg-accent/30"
                      >
                        <td className="py-2 px-2 whitespace-nowrap">
                          {fmtDate(r.paidDate)}
                        </td>
                        <td className="py-2 px-2">{r.description}</td>
                        <td className="py-2 px-2 text-right font-medium">
                          {formatCurrency(r.amount)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            onClick={() => {
                              setEditing(r)
                              setShowForm(true)
                            }}
                            title="Editar"
                            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(r)}
                            title="Excluir"
                            className="p-1.5 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
                <span>
                  {data.total} reposição(ões) · Página {data.page} de {data.totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ReposicaoFormModal
        open={showForm}
        onClose={() => {
          setShowForm(false)
          setEditing(null)
        }}
        editing={editing}
        onConfirm={handleSave}
      />
    </div>
  )
}
