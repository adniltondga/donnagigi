"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LifeBuoy, Plus, Loader2, MessageSquare } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { feedback } from "@/lib/feedback"

interface TicketRow {
  id: string
  subject: string
  status: "OPEN" | "IN_PROGRESS" | "WAITING_CLIENT" | "CLOSED"
  category: "BUG" | "DUVIDA" | "INTEGRACAO" | "FINANCEIRO" | "OUTRO"
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
  updatedAt: string
  createdAt: string
  lastStaffReplyAt: string | null
  openedBy: { name: string }
  _count: { messages: number }
}

const STATUS_LABEL: Record<TicketRow["status"], string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  WAITING_CLIENT: "Aguardando você",
  CLOSED: "Encerrado",
}

const STATUS_TONE: Record<TicketRow["status"], string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  WAITING_CLIENT: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  CLOSED: "bg-muted text-muted-foreground",
}

const CATEGORY_LABEL: Record<TicketRow["category"], string> = {
  BUG: "Bug",
  DUVIDA: "Dúvida",
  INTEGRACAO: "Integração",
  FINANCEIRO: "Financeiro",
  OUTRO: "Outro",
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

export default function SuportePage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<TicketRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/tickets")
      const data = await res.json()
      setTickets(data.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="🎫 Suporte"
        description="Abra um chamado quando precisar de ajuda. Respondemos por aqui e por email."
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Abrir chamado
          </Button>
        }
      />

      {loading ? (
        <Card className="p-0">
          <LoadingState variant="card" label="Carregando chamados…" />
        </Card>
      ) : tickets && tickets.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={LifeBuoy}
            title="Nenhum chamado ainda"
            description="Quando você abrir um chamado, ele aparece aqui com toda a thread."
            action={
              <Button onClick={() => setShowNew(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Abrir o primeiro chamado
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets?.map((t) => (
            <Link
              key={t.id}
              href={`/admin/suporte/${t.id}`}
              className="block group"
            >
              <Card className="p-4 hover:shadow-md hover:border-primary-200 transition">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-foreground group-hover:text-primary-600 transition truncate">
                        {t.subject}
                      </h3>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_TONE[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABEL[t.category]} · aberto em {formatDate(t.createdAt)}
                      {t.lastStaffReplyAt && (
                        <> · última resposta do suporte em {formatDate(t.lastStaffReplyAt)}</>
                      )}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {t._count.messages}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <NewTicketDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={(id) => {
          setShowNew(false)
          feedback.success("Chamado aberto — vamos responder em breve")
          router.push(`/admin/suporte/${id}`)
        }}
      />
    </div>
  )
}

function NewTicketDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [category, setCategory] = useState<TicketRow["category"]>("DUVIDA")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, category }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        feedback.error(d.error || "Erro ao abrir chamado")
        return
      }
      const { id } = await res.json()
      setSubject("")
      setBody("")
      setCategory("DUVIDA")
      onCreated(id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Abrir novo chamado</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketRow["category"])}
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground"
            >
              <option value="DUVIDA">Dúvida</option>
              <option value="BUG">Bug / Erro no sistema</option>
              <option value="INTEGRACAO">Integração ML/MP</option>
              <option value="FINANCEIRO">Financeiro / Cobrança</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Assunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={140}
              placeholder="Resuma o problema em uma linha"
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={6}
              placeholder="Conta o que aconteceu, passos pra reproduzir, anúncio/pedido envolvido (se for o caso)…"
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground resize-y"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !subject.trim() || !body.trim()}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Abrir chamado
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
