"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, Send, Headset, User as UserIcon } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { feedback } from "@/lib/feedback"

interface Message {
  id: string
  body: string
  authorRole: "CLIENT" | "STAFF"
  createdAt: string
  author: { id: string; name: string }
}

interface Ticket {
  id: string
  subject: string
  status: "OPEN" | "IN_PROGRESS" | "WAITING_CLIENT" | "CLOSED"
  category: "BUG" | "DUVIDA" | "INTEGRACAO" | "FINANCEIRO" | "OUTRO"
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
  createdAt: string
  closedAt: string | null
  openedBy: { id: string; name: string; email: string }
  assignee: { id: string; name: string } | null
  messages: Message[]
}

const STATUS_LABEL: Record<Ticket["status"], string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  WAITING_CLIENT: "Aguardando você",
  CLOSED: "Encerrado",
}

const STATUS_TONE: Record<Ticket["status"], string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  WAITING_CLIENT: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  CLOSED: "bg-muted text-muted-foreground",
}

function formatDateTime(s: string): string {
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const threadEndRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tickets/${id}`)
      if (!res.ok) {
        feedback.error("Chamado não encontrado")
        setTicket(null)
        return
      }
      const data = await res.json()
      setTicket(data)
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
      const res = await fetch(`/api/tickets/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        feedback.error(d.error || "Erro ao enviar")
        return
      }
      setReply("")
      await load()
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <LoadingState size="md" label="Carregando…" />
  }
  if (!ticket) {
    return (
      <div className="space-y-4">
        <Link href="/admin/suporte" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar pra lista
        </Link>
        <Card className="p-8 text-center text-muted-foreground">Chamado não encontrado.</Card>
      </div>
    )
  }

  const isClosed = ticket.status === "CLOSED"

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/admin/suporte"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar pra lista de chamados
      </Link>

      <PageHeader
        title={ticket.subject}
        description={`Aberto em ${formatDateTime(ticket.createdAt)}${
          ticket.closedAt ? ` · encerrado em ${formatDateTime(ticket.closedAt)}` : ""
        }`}
        badge={
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_TONE[ticket.status]}`}>
            {STATUS_LABEL[ticket.status]}
          </span>
        }
      />

      <Card className="p-0 overflow-hidden">
        <div className="divide-y divide-border">
          {ticket.messages.map((m) => {
            const isStaff = m.authorRole === "STAFF"
            return (
              <div
                key={m.id}
                className={`p-4 flex gap-3 ${
                  isStaff ? "bg-primary-50/40 dark:bg-primary-900/10" : ""
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isStaff
                      ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isStaff ? <Headset className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-foreground">
                      {isStaff ? "Suporte" : m.author.name}
                    </span>
                    {isStaff && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-primary-600 text-white px-1.5 py-0.5 rounded">
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
      </Card>

      {isClosed ? (
        <Card className="p-4 bg-muted text-sm text-muted-foreground">
          Este chamado foi encerrado. Se ainda precisa de ajuda,{" "}
          <Link href="/admin/suporte" className="text-primary-600 hover:underline">
            abra um novo chamado
          </Link>
          .
        </Card>
      ) : (
        <Card className="p-4">
          <form onSubmit={submitReply} className="space-y-3">
            <label className="block text-sm font-medium text-foreground">Sua resposta</label>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              placeholder="Escreva sua resposta aqui…"
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground resize-y"
              disabled={sending}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={sending || !reply.trim()}>
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar resposta
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
