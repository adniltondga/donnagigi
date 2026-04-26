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
  OPEN: "bg-blue-900/40 text-blue-300 border-blue-800",
  IN_PROGRESS: "bg-amber-900/40 text-amber-300 border-amber-800",
  WAITING_CLIENT: "bg-zinc-800 text-zinc-400 border-zinc-700",
  CLOSED: "bg-zinc-900 text-zinc-500 border-zinc-800",
}

const PRIORITY_TONE: Record<TicketRow["priority"], string> = {
  LOW: "text-zinc-500",
  NORMAL: "text-zinc-400",
  HIGH: "text-amber-400",
  URGENT: "text-red-400 font-bold",
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
          <p className="text-sm text-zinc-500">Todos os chamados abertos pelos clientes.</p>
        </div>
        <div className="flex gap-2 items-center">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setQ(qInput.trim())
            }}
            className="relative"
          >
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Buscar por assunto…"
              className="bg-zinc-900 border border-zinc-800 rounded-md pl-9 pr-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 w-64"
            />
          </form>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm"
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 flex items-center justify-center text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Carregando…
        </div>
      ) : tickets && tickets.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center text-zinc-500">
          Nenhum ticket encontrado.
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
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
            <tbody className="divide-y divide-zinc-800">
              {tickets?.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-950 transition">
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
                      className="font-medium text-zinc-100 hover:text-primary-400"
                    >
                      {t.subject}
                    </Link>
                    {t.priority !== "NORMAL" && (
                      <span className={`ml-2 text-xs ${PRIORITY_TONE[t.priority]}`}>
                        {t.priority === "URGENT" ? "🔥 URGENTE" : t.priority === "HIGH" ? "↑ alta" : "↓ baixa"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    <div>{t.tenant.name}</div>
                    <div className="text-xs text-zinc-500">{t.openedBy.email}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {t.assignee?.name || <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{CATEGORY_LABEL[t.category]}</td>
                  <td className="px-4 py-3 text-right text-xs text-zinc-500 whitespace-nowrap">
                    {formatDate(t.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400">
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
