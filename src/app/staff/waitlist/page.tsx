"use client"

import { useEffect, useState } from "react"
import { Loader2, Mail, Send, AlertTriangle } from "lucide-react"
import { feedback } from "@/lib/feedback"
import { LoadingState } from "@/components/ui/loading-state"

interface Signup {
  id: string
  email: string
  source: string | null
  notified: boolean
  createdAt: string
}

interface Stats {
  total: number
  pending: number
  notified: number
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

export default function StaffWaitlistPage() {
  const [signups, setSignups] = useState<Signup[] | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/staff/waitlist")
      const data = await res.json()
      setSignups(data.data || [])
      setStats(data.stats || null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const broadcast = async () => {
    setBroadcasting(true)
    try {
      const res = await fetch("/api/staff/waitlist/broadcast", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        feedback.error(data.error || "Erro no broadcast")
        return
      }
      feedback.success(
        `Broadcast enviado: ${data.sent} ok, ${data.failed} falhou (de ${data.total})`
      )
      setConfirmOpen(false)
      load()
    } finally {
      setBroadcasting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Lista de espera</h2>
          <p className="text-sm text-muted-foreground">
            Pessoas que pediram pra ser avisadas quando o cadastro abrir.
          </p>
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={!stats || stats.pending === 0}
          className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-semibold inline-flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          Avisar {stats?.pending ?? 0} pendente{stats?.pending === 1 ? "" : "s"}
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KPI label="Total" value={String(stats.total)} />
          <KPI label="A avisar" value={String(stats.pending)} accent="amber" />
          <KPI label="Já avisados" value={String(stats.notified)} accent="emerald" />
        </div>
      )}

      {loading ? (
        <div className="bg-card border border-border rounded-lg">
          <LoadingState variant="card" label="Carregando…" />
        </div>
      ) : !signups || signups.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">
          Ninguém na lista ainda.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-app-bg text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Origem</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {signups.map((s) => (
                <tr key={s.id} className="hover:bg-app-bg transition">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-foreground">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      {s.email}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {s.source || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.notified ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800">
                        Avisado
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800">
                        Pendente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(s.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de confirmação */}
      {confirmOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => !broadcasting && setConfirmOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-lg max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Disparar broadcast?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Vamos enviar o email <strong>&ldquo;agLivre está no ar&rdquo;</strong> pra{" "}
                  <strong>{stats?.pending ?? 0}</strong> pessoa(s). Ação irreversível —
                  cada signup é marcado como avisado depois do envio.
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-muted rounded p-3">
              💡 Antes de disparar, garante que o cadastro está aberto:
              <code className="block mt-1 font-mono text-foreground">
                NEXT_PUBLIC_REGISTRATION_OPEN=true
              </code>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-border">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={broadcasting}
                className="px-4 py-2 rounded-md text-sm border border-border hover:bg-accent disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={broadcast}
                disabled={broadcasting}
                className="px-4 py-2 rounded-md text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white inline-flex items-center gap-2"
              >
                {broadcasting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {broadcasting ? "Enviando…" : "Disparar broadcast"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KPI({
  label,
  value,
  accent = "default",
}: {
  label: string
  value: string
  accent?: "default" | "amber" | "emerald"
}) {
  const accentCls = {
    default: "text-foreground",
    amber: "text-amber-600 dark:text-amber-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
  }[accent]
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accentCls}`}>{value}</p>
    </div>
  )
}
