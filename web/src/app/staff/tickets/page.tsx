"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, MessageSquare, Search } from "lucide-react"

interface TicketRow {
  id: string
  subject: string
  status: "OPEN" | "IN_PROGRESS" | "WAITING_CLIENT" | "CLOSED"
  category: "BUG" | "DUVIDA" | "INTEGRACAO" | "FINANCEIRO" | "OUTRO"
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
  updatedAt: string
  createdAt: string
  lastClientReplyAt: string | null
  lastStaffReplyAt: string | null
  tenant: { id: string; name: string; slug: string }
  openedBy: { id: string; name: string; email: string }
  assignee: { id: string; name: string } | null
  _count: { messages: number }
}

const STATUS_LABEL: Record<TicketRow["status"], string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  WAITING_CLIENT: "Aguardando cliente",
  CLOSED: "Encerrado",
}

const STATUS_TONE: Record<TicketRow["status"], string> = {
  OPEN: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  WAITING_CLIENT: "bg-muted text-muted-foreground border-border",
  CLOSED: "bg-card text-muted-foreground border-border",
}

const PRIORITY_TONE: Record<TicketRow["priority"], string> = {
  LOW: "text-muted-foreground",
  NORMAL: "text-muted-foreground",
  HIGH: "text-amber-600 dark:text-amber-400",
  URGENT: "text-red-600 dark:text-red-400 font-bold",
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

export default function StaffTicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [q, setQ] = useState("")
  const [qInput, setQInput] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (q) params.set("q", q)
      const res = await fetch(`/api/staff/tickets?${params}`)
      const data = await res.json()
      setTickets(data.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, q])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Tickets</h2>
          <p className="text-sm text-muted-foreground">Todos os chamados abertos pelos clientes.</p>
        </div>
        <div className="flex gap-2 items-center">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setQ(qInput.trim())
            }}
            className="relative"
          >
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Buscar por assunto…"
              className="bg-card border border-border rounded-md pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border w-64"
            />
          </form>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="OPEN">Abertos</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="WAITING_CLIENT">Aguardando cliente</option>
            <option value="CLOSED">Encerrados</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-lg p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Carregando…
        </div>
      ) : tickets && tickets.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">
          Nenhum ticket encontrado.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-app-bg text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Assunto</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Atribuído</th>
                <th className="text-left px-4 py-3">Categoria</th>
                <th className="text-right px-4 py-3">Atualizado</th>
                <th className="text-right px-4 py-3">Msg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets?.map((t) => (
                <tr key={t.id} className="hover:bg-app-bg transition">
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${STATUS_TONE[t.status]}`}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/staff/tickets/${t.id}`}
                      className="font-medium text-foreground hover:text-primary-600 dark:text-primary-400"
                    >
                      {t.subject}
                    </Link>
                    {t.priority !== "NORMAL" && (
                      <span className={`ml-2 text-xs ${PRIORITY_TONE[t.priority]}`}>
                        {t.priority === "URGENT" ? "🔥 URGENTE" : t.priority === "HIGH" ? "↑ alta" : "↓ baixa"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{t.tenant.name}</div>
                    <div className="text-xs text-muted-foreground">{t.openedBy.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.assignee?.name || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{CATEGORY_LABEL[t.category]}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(t.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {t._count.messages}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
