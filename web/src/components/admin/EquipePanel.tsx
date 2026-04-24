"use client"

import { useEffect, useState } from "react"
import {
  Users,
  UserPlus,
  Shield,
  Eye,
  Crown,
  Trash2,
  Mail,
  Clock,
  Loader,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

type Role = "OWNER" | "ADMIN" | "VIEWER"

interface Member {
  id: string
  name: string
  email: string
  username: string
  role: Role
  emailVerified: boolean
  createdAt: string
}
interface PendingInvite {
  id: string
  email: string
  role: Role
  expiresAt: string
  createdAt: string
  createdBy: { name: string }
}

const ROLE_META: Record<Role, { label: string; icon: any; tone: string; desc: string }> = {
  OWNER: { label: "Dono", icon: Crown, tone: "bg-amber-50 text-amber-700 border-amber-200", desc: "Acesso total. Gerencia assinatura e equipe." },
  ADMIN: { label: "Admin", icon: Shield, tone: "bg-primary-50 text-primary-700 border-primary-200", desc: "Mexe em tudo: custos, pedidos, integrações." },
  VIEWER: { label: "Visualizador", icon: Eye, tone: "bg-gray-100 text-gray-700 border-gray-200", desc: "Só leitura: dashboard, relatórios e pedidos." },
}

export function EquipePanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [pending, setPending] = useState<PendingInvite[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const [currentRole, setCurrentRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [teamRes, meRes] = await Promise.all([fetch("/api/team"), fetch("/api/auth/me")])
      if (!teamRes.ok) {
        if (teamRes.status === 403) {
          setError("Você não tem permissão pra acessar essa área.")
        } else {
          setError("Erro ao carregar equipe.")
        }
        return
      }
      const data = await teamRes.json()
      setMembers(data.members || [])
      setPending(data.pending || [])
      setCurrentUserId(data.currentUserId)
      if (meRes.ok) {
        const me = await meRes.json()
        setCurrentRole(me.role)
      }
    } catch {
      setError("Erro de conexão.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const flash = (type: "success" | "error", text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 5000)
  }

  const changeRole = async (userId: string, role: Role) => {
    try {
      const res = await fetch(`/api/team/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      if (res.ok) {
        flash("success", "Papel atualizado.")
        load()
      } else {
        const d = await res.json().catch(() => ({}))
        flash("error", d.error || "Erro ao mudar papel")
      }
    } catch {
      flash("error", "Erro de conexão")
    }
  }

  const removeMember = async (userId: string, name: string) => {
    if (!confirm(`Remover ${name} da equipe? Essa pessoa perde o acesso imediatamente.`)) return
    try {
      const res = await fetch(`/api/team/${userId}`, { method: "DELETE" })
      if (res.ok) {
        flash("success", "Membro removido.")
        load()
      } else {
        const d = await res.json().catch(() => ({}))
        flash("error", d.error || "Erro ao remover")
      }
    } catch {
      flash("error", "Erro de conexão")
    }
  }

  const cancelInvite = async (id: string, email: string) => {
    if (!confirm(`Cancelar convite pra ${email}?`)) return
    try {
      const res = await fetch(`/api/team/invites/${id}`, { method: "DELETE" })
      if (res.ok) {
        flash("success", "Convite cancelado.")
        load()
      } else {
        flash("error", "Erro ao cancelar convite")
      }
    } catch {
      flash("error", "Erro de conexão")
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-3" />
          <p className="text-gray-700">{error}</p>
        </CardContent>
      </Card>
    )
  }

  const canInvite = currentRole === "OWNER" || currentRole === "ADMIN"

  return (
    <div className="space-y-4">
      {msg && (
        <div
          className={`rounded-lg border p-3 flex items-start gap-2 text-sm ${
            msg.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {msg.type === "success" ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
          <p>{msg.text}</p>
        </div>
      )}

      {/* Membros */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-600" />
                Membros ({members.length})
              </CardTitle>
              <CardDescription>Pessoas com conta ativa no seu negócio.</CardDescription>
            </div>
            {canInvite && (
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Convidar membro
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader className="w-5 h-5 animate-spin mr-2" />
              Carregando...
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {members.map((m) => {
                const meta = ROLE_META[m.role]
                const Icon = meta.icon
                const isSelf = m.id === currentUserId
                const isOwner = m.role === "OWNER"
                return (
                  <div key={m.id} className="py-4 flex items-center gap-4 flex-wrap">
                    <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {m.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{m.name}</span>
                        {isSelf && <span className="text-xs text-gray-500">(você)</span>}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {m.email}
                      </div>
                    </div>
                    <Badge variant="outline" className={`${meta.tone} border`}>
                      <Icon className="w-3 h-3 mr-1" />
                      {meta.label}
                    </Badge>
                    {currentRole === "OWNER" && !isOwner && !isSelf && (
                      <div className="flex gap-1">
                        <select
                          value={m.role}
                          onChange={(e) => changeRole(m.id, e.target.value as Role)}
                          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="VIEWER">Visualizador</option>
                        </select>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeMember(m.id, m.name)}
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {currentRole === "ADMIN" && m.role === "VIEWER" && !isSelf && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeMember(m.id, m.name)}
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Convites pendentes */}
      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Convites pendentes ({pending.length})
            </CardTitle>
            <CardDescription>Aguardando aceite por email.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {pending.map((p) => {
                const meta = ROLE_META[p.role]
                const Icon = meta.icon
                return (
                  <div key={p.id} className="py-3 flex items-center gap-3 flex-wrap">
                    <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{p.email}</div>
                      <div className="text-xs text-gray-500">
                        Convidado por {p.createdBy.name} · Expira em {new Date(p.expiresAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <Badge variant="outline" className={`${meta.tone} border`}>
                      <Icon className="w-3 h-3 mr-1" />
                      {meta.label}
                    </Badge>
                    {canInvite && (
                      <Button variant="outline" size="sm" onClick={() => cancelInvite(p.id, p.email)}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onDone={(type, text) => {
          flash(type, text)
          setInviteOpen(false)
          load()
        }}
      />
    </div>
  )
}

function InviteDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: (type: "success" | "error", text: string) => void
}) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"ADMIN" | "VIEWER">("VIEWER")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setEmail("")
      setRole("VIEWER")
    }
  }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        onDone("success", `Convite enviado pra ${email}.`)
      } else {
        onDone("error", d.error || "Erro ao enviar convite")
      }
    } catch {
      onDone("error", "Erro de conexão")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar novo membro</DialogTitle>
          <DialogDescription>
            Vamos mandar um email com o link pra pessoa criar a senha dela e entrar na sua equipe.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="socio@empresa.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Papel</label>
            <div className="space-y-2">
              {(["ADMIN", "VIEWER"] as const).map((r) => {
                const meta = ROLE_META[r]
                const Icon = meta.icon
                return (
                  <label
                    key={r}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      role === r ? "border-primary-600 bg-primary-50" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={role === r}
                      onChange={() => setRole(r)}
                      className="mt-1"
                    />
                    <Icon className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{meta.label}</div>
                      <div className="text-xs text-gray-500">{meta.desc}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !email}>
              {submitting && <Loader className="w-4 h-4 animate-spin mr-2" />}
              Enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
