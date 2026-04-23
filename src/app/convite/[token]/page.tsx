"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, Loader, AlertCircle, UserPlus, Shield, Crown } from "lucide-react"

type Role = "OWNER" | "ADMIN" | "VIEWER"

interface InviteData {
  email: string
  role: Role
  tenantName: string
  inviterName: string
}

const ROLE_LABEL: Record<Role, { label: string; icon: any; desc: string }> = {
  OWNER: { label: "Dono", icon: Crown, desc: "" },
  ADMIN: { label: "Administrador", icon: Shield, desc: "acesso total — mexe em tudo." },
  VIEWER: { label: "Visualizador", icon: Eye, desc: "só leitura de relatórios e pedidos." },
}

export default function ConvitePage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/invites/${params.token}`)
      .then(async (r) => {
        if (r.ok) {
          setInvite(await r.json())
        } else {
          const d = await r.json().catch(() => ({}))
          setError(d.error || "Convite inválido")
        }
      })
      .catch(() => setError("Erro de conexão"))
      .finally(() => setLoading(false))
  }, [params.token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (password !== confirm) {
      setSubmitError("As senhas não conferem")
      return
    }
    if (password.length < 6) {
      setSubmitError("Senha precisa ter ao menos 6 caracteres")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/invites/${params.token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        // Guarda token no localStorage (caso outras partes leiam) e vai pro dashboard
        if (d.token) localStorage.setItem("adminToken", d.token)
        router.push("/admin/dashboard")
      } else {
        setSubmitError(d.error || "Erro ao aceitar convite")
      }
    } catch {
      setSubmitError("Erro de conexão")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-fuchsia-50">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader className="w-5 h-5 animate-spin" />
          Carregando convite...
        </div>
      </div>
    )
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-fuchsia-50 p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-8 max-w-md text-center space-y-4">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Convite inválido</h2>
            <p className="text-sm text-gray-600 mt-2">{error || "Este convite não existe."}</p>
          </div>
          <Link
            href="/admin/login"
            className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-lg"
          >
            Ir pra tela de login
          </Link>
        </div>
      </div>
    )
  }

  const meta = ROLE_LABEL[invite.role]
  const Icon = meta.icon

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-fuchsia-50 p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full">
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-primary-600 p-2 rounded-lg">
            <span className="text-white font-bold text-sm">aL</span>
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">
            ag<span className="text-primary-600">Livre</span>
          </span>
        </div>

        <div className="bg-gradient-to-br from-primary-50 to-fuchsia-50 border border-primary-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="w-4 h-4 text-primary-600" />
            <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Convite pra equipe</span>
          </div>
          <p className="text-sm text-gray-700">
            <strong>{invite.inviterName}</strong> te convidou pra <strong>{invite.tenantName}</strong> como{" "}
            <span className="inline-flex items-center gap-1 font-semibold text-primary-700">
              <Icon className="w-3.5 h-3.5" />
              {meta.label}
            </span>
            .
          </p>
          {meta.desc && <p className="text-xs text-gray-500 mt-1">Você terá {meta.desc}</p>}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-gray-400 font-normal">(não editável)</span>
            </label>
            <input
              type="email"
              value={invite.email}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              placeholder="Ex: João Silva"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Defina uma senha</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                className="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirme a senha</label>
            <input
              type={showPwd ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
            />
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{submitError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !name || !password || !confirm}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader className="w-4 h-4 animate-spin" />}
            {submitting ? "Entrando..." : "Aceitar convite e entrar"}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-6">
          Ao aceitar, você concorda em compartilhar seu email com {invite.tenantName}.
        </p>
      </div>
    </div>
  )
}
