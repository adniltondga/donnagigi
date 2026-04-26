"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, Send, Headset, User as UserIcon, Building2, Mail } from "lucide-react"
import { feedback } from "@/lib/feedback"
import { LoadingState } from "@/components/ui/loading-state"

interface Message {
  id: string
  body: string
  authorRole: "CLIENT" | "STAFF"
  createdAt: string
  author: { id: string; name: string }
}

type Status = "OPEN" | "IN_PROGRESS" | "WAITING_CLIENT" | "CLOSED"
type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT"
type Category = "BUG" | "DUVIDA" | "INTEGRACAO" | "FINANCEIRO" | "OUTRO"

interface Ticket {
  id: string
  subject: string
  status: Status
  priority: Priority
  category: Category
  createdAt: string
  closedAt: string | null
  tenant: { id: string; name: string; slug: string }
  openedBy: { id: string; name: string; email: string }
  assignee: { id: string; name: string } | null
  messages: Message[]
}

const STATUS_LABEL: Record<Status, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  WAITING_CLIENT: "Aguardando cliente",
  CLOSED: "Encerrado",
}

const CATEGORY_LABEL: Record<Category, string> = {
  BUG: "Bug",
  DUVIDA: "Dúvida",
  INTEGRACAO: "Integração",
  FINANCEIRO: "Financeiro",
  OUTRO: "Outro",
}

function formatDateTime(s: string): string {
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

export default function StaffTicketDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState("")
  const [replyStatus, setReplyStatus] = useState<Status | "">("")
  const [sending, setSending] = useState(false)
  const threadEndRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/tickets/${id}`)
      if (!res.ok) {
        feedback.error("Ticket não encontrado")
        setTicket(null)
        return
      }
      setTicket(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [ticket?.messages.length])

  const submitReply = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = reply.trim()
    if (!body) return
    setSending(true)
    try {
      const res = await fetch(`/api/staff/tickets/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, status: replyStatus || undefined }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        feedback.error(d.error || "Erro ao enviar")
        return
      }
      setReply("")
      setReplyStatus("")
      feedback.success("Resposta enviada — cliente será notificado por email")
      await load()
    } finally {
      setSending(false)
    }
  }

  const updateField = async (data: Partial<Pick<Ticket, "status" | "priority">>) => {
    const res = await fetch(`/api/staff/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      feedback.error("Erro ao atualizar")
      return
    }
    feedback.success("Atualizado")
    load()
  }

  if (loading) {
    return <LoadingState size="md" label="Carregando…" />
  }
  if (!ticket) {
    return (
      <div className="space-y-4">
        <Link
          href="/staff/tickets"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar
        </Link>
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
          Ticket não encontrado.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link
        href="/staff/tickets"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar pra lista
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        {/* Coluna principal — thread + reply */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">{ticket.subject}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Aberto em {formatDateTime(ticket.createdAt)}
              {ticket.closedAt && ` · encerrado em ${formatDateTime(ticket.closedAt)}`}
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="divide-y divide-border">
              {ticket.messages.map((m) => {
                const isStaff = m.authorRole === "STAFF"
                return (
                  <div key={m.id} className={`p-4 flex gap-3 ${isStaff ? "bg-primary-50 dark:bg-primary-950/30" : ""}`}>
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        isStaff
                          ? "bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isStaff ? <Headset className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-foreground">{m.author.name}</span>
                        {isStaff && (
                          <span className="text-[10px] font-bold uppercase tracking-wide bg-primary-700 text-white px-1.5 py-0.5 rounded">
                            Staff
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                      </div>
                      <div className="text-sm text-foreground whitespace-pre-wrap">{m.body}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={threadEndRef} />
            </div>
          </div>

          {ticket.status !== "CLOSED" && (
            <form onSubmit={submitReply} className="bg-card border border-border rounded-lg p-4 space-y-3">
              <label className="block text-sm font-medium text-foreground">Responder</label>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={5}
                placeholder="Sua resposta…"
                className="w-full bg-app-bg border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:border-border"
                disabled={sending}
              />
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Após enviar, marcar como:
                  <select
                    value={replyStatus}
                    onChange={(e) => setReplyStatus(e.target.value as Status | "")}
                    className="bg-app-bg border border-border rounded-md px-2 py-1 text-xs"
                  >
                    <option value="">manter / IN_PROGRESS</option>
                    <option value="WAITING_CLIENT">Aguardando cliente</option>
                    <option value="CLOSED">Encerrar</option>
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={sending || !reply.trim()}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-semibold inline-flex items-center gap-2"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Coluna lateral — metadados + ações */}
        <aside className="space-y-3">
          <div className="bg-card border border-border rounded-lg p-4 space-y-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Status</p>
              <select
                value={ticket.status}
                onChange={(e) => updateField({ status: e.target.value as Status })}
                className="w-full bg-app-bg border border-border rounded-md px-2 py-1.5 text-sm"
              >
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Prioridade</p>
              <select
                value={ticket.priority}
                onChange={(e) => updateField({ priority: e.target.value as Priority })}
                className="w-full bg-app-bg border border-border rounded-md px-2 py-1.5 text-sm"
              >
                <option value="LOW">Baixa</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente 🔥</option>
              </select>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Categoria</p>
              <p className="text-foreground">{CATEGORY_LABEL[ticket.category]}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Atribuído a</p>
              <p className="text-foreground">{ticket.assignee?.name || "ninguém"}</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4 space-y-3 text-sm">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cliente</p>
            <div className="space-y-1">
              <p className="text-foreground font-medium flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                {ticket.tenant.name}
              </p>
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                {ticket.openedBy.name}
              </p>
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <a href={`mailto:${ticket.openedBy.email}`} className="hover:text-foreground">
                  {ticket.openedBy.email}
                </a>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
