"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  User,
  KeyRound,
  Plug,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Loader,
  LogOut,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  FileText,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/calculations"

type Tab = "perfil" | "senha" | "ml" | "assinatura"

const TABS: Array<{ key: Tab; label: string; icon: LucideIcon }> = [
  { key: "perfil", label: "Perfil", icon: User },
  { key: "senha", label: "Alterar senha", icon: KeyRound },
  { key: "ml", label: "Integração ML", icon: Plug },
  { key: "assinatura", label: "Assinatura", icon: CreditCard },
]

function ConfigInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [tab, setTab] = useState<Tab>("perfil")

  useEffect(() => {
    const t = params.get("tab") as Tab | null
    if (t && TABS.some((x) => x.key === t)) setTab(t)
  }, [params])

  const switchTab = (t: Tab) => {
    setTab(t)
    router.replace(`/admin/configuracoes?tab=${t}`, { scroll: false })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Gerencie seu perfil, senha, integrações e assinatura." />

      {/* Tabs */}
      <div className="border-b border-gray-200 flex flex-wrap gap-1">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                active
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "perfil" && <PerfilPanel />}
      {tab === "senha" && <SenhaPanel />}
      {tab === "ml" && <MLPanel initialSuccess={params.get("success")} initialError={params.get("error")} />}
      {tab === "assinatura" && <AssinaturaPanel />}
    </div>
  )
}

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={null}>
      <ConfigInner />
    </Suspense>
  )
}

/* ------------------- PERFIL ------------------- */

function PerfilPanel() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [tenantName, setTenantName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setName(d.name || "")
        setEmail(d.email || "")
        setTenantName(d.tenant?.name || "")
      })
      .finally(() => setLoading(false))
  }, [])

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tenantName }),
      })
      if (res.ok) {
        setMsg({ type: "success", text: "Perfil atualizado." })
      } else {
        const d = await res.json().catch(() => ({}))
        setMsg({ type: "error", text: d.error || "Erro ao salvar" })
      }
    } catch {
      setMsg({ type: "error", text: "Erro de conexão" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingBox />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meu perfil</CardTitle>
        <CardDescription>Atualize seus dados pessoais e o nome do seu negócio.</CardDescription>
      </CardHeader>
      <CardContent>
        {msg && <StatusMessage status={msg.type} message={msg.text} />}

        <form onSubmit={onSave} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-gray-400 font-normal">(não editável)</span>
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do negócio</label>
            <input
              type="text"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
              minLength={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {saving && <Loader className="w-4 h-4 animate-spin" />}
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

/* ------------------- ALTERAR SENHA ------------------- */

function SenhaPanel() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (next !== confirm) {
      setMsg({ type: "error", text: "As senhas não conferem" })
      return
    }
    if (next.length < 6) {
      setMsg({ type: "error", text: "A nova senha precisa ter ao menos 6 caracteres" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg({ type: "success", text: "Senha alterada com sucesso." })
        setCurrent("")
        setNext("")
        setConfirm("")
      } else {
        setMsg({ type: "error", text: d.error || "Erro ao trocar senha" })
      }
    } catch {
      setMsg({ type: "error", text: "Erro de conexão" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alterar senha</CardTitle>
        <CardDescription>Proteja sua conta trocando a senha periodicamente.</CardDescription>
      </CardHeader>
      <CardContent>
        {msg && <StatusMessage status={msg.type} message={msg.text} />}

        <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
          <PasswordField label="Senha atual" value={current} onChange={setCurrent} show={show} toggleShow={() => setShow((v) => !v)} required />
          <PasswordField label="Nova senha" value={next} onChange={setNext} show={show} toggleShow={() => setShow((v) => !v)} hint="Mínimo 6 caracteres" required minLength={6} />
          <PasswordField label="Confirmar nova senha" value={confirm} onChange={setConfirm} show={show} toggleShow={() => setShow((v) => !v)} required minLength={6} />

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {saving && <Loader className="w-4 h-4 animate-spin" />}
              {saving ? "Salvando..." : "Trocar senha"}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  toggleShow,
  hint,
  required,
  minLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  toggleShow: () => void
  hint?: string
  required?: boolean
  minLength?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          className="w-full pr-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

/* ------------------- INTEGRAÇÃO ML ------------------- */

function MLPanel({ initialSuccess, initialError }: { initialSuccess: string | null; initialError: string | null }) {
  const [integration, setIntegration] = useState<{
    configured: boolean
    sellerID?: string
    expiresAt?: string
    isExpired?: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<"idle" | "loading" | "syncing" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [syncResult, setSyncResult] = useState<any>(null)

  const check = async () => {
    try {
      const res = await fetch("/api/mercadolivre/integration")
      const d = await res.json()
      setIntegration(d)
    } catch {
      setIntegration({ configured: false })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    check()
  }, [])

  useEffect(() => {
    if (initialSuccess) {
      setStatus("success")
      setMessage(decodeURIComponent(initialSuccess))
    } else if (initialError) {
      setStatus("error")
      setMessage(decodeURIComponent(initialError))
    }
  }, [initialSuccess, initialError])

  const handleLogin = () => {
    setStatus("loading")
    window.location.href = "/api/ml/oauth/login"
  }

  const handleDisconnect = async () => {
    if (!confirm("Desconectar a integração com Mercado Livre?")) return
    try {
      const res = await fetch("/api/mercadolivre/integration", { method: "DELETE" })
      if (res.ok) {
        setStatus("success")
        setMessage("Desconectado do Mercado Livre")
        setIntegration(null)
        setTimeout(check, 500)
      }
    } catch {
      setStatus("error")
      setMessage("Erro ao desconectar")
    }
  }

  const syncProducts = async () => {
    setStatus("syncing")
    setMessage("")
    setSyncResult(null)
    try {
      const res = await fetch("/api/ml/sync", { method: "GET" })
      const data = await res.json()
      if (!res.ok) {
        setStatus("error")
        setMessage(data.error || "Erro ao sincronizar produtos")
        return
      }
      setSyncResult(data)
      setStatus("success")
      setMessage(data.message)
      setTimeout(() => {
        setStatus("idle")
        setMessage("")
      }, 10000)
    } catch (err) {
      setStatus("error")
      setMessage(`Erro: ${err instanceof Error ? err.message : "desconhecido"}`)
    }
  }

  const syncOrders = async () => {
    setStatus("syncing")
    setMessage("")
    setSyncResult(null)
    try {
      const res = await fetch("/api/ml/sync-orders", { method: "GET" })
      const data = await res.json()
      if (!res.ok) {
        setStatus("error")
        setMessage(data.error || "Erro ao sincronizar vendas")
        return
      }
      setSyncResult(data)
      setStatus("success")
      setMessage(data.message)
      setTimeout(() => {
        setStatus("idle")
        setMessage("")
      }, 10000)
    } catch (err) {
      setStatus("error")
      setMessage(`Erro: ${err instanceof Error ? err.message : "desconhecido"}`)
    }
  }

  return (
    <div className="space-y-4">
      {message && <StatusMessage status={status === "success" ? "success" : "error"} message={message} />}

      {/* Credenciais do app ML do tenant */}
      <AppCredentialsCard />


      {/* Card principal de status */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Plug className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Mercado Livre</CardTitle>
                <CardDescription>
                  Conecte sua conta do ML via OAuth pra sincronizar produtos e vendas.
                </CardDescription>
              </div>
            </div>
            {!loading && (
              <Badge variant={integration?.configured ? (integration.isExpired ? "destructive" : "default") : "secondary"}>
                {loading ? "..." : integration?.configured ? (integration.isExpired ? "Expirado" : "Conectado") : "Não conectado"}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <LoadingBox />
          ) : integration?.configured ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-gray-100">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Seller ID</div>
                  <div className="text-sm font-mono font-semibold text-gray-900 mt-1">{integration.sellerID}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    {integration.isExpired ? "Token expirou em" : "Token válido até"}
                  </div>
                  <div className="text-sm font-medium text-gray-900 mt-1">
                    {integration.expiresAt ? new Date(integration.expiresAt).toLocaleString("pt-BR") : "—"}
                  </div>
                </div>
              </div>

              {integration.isExpired && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Token expirado</p>
                    <p>Reconecte pra voltar a sincronizar.</p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={syncProducts} disabled={status === "syncing"} variant="default" size="sm">
                  {status === "syncing" ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Sincronizar produtos
                </Button>
                <Button onClick={syncOrders} disabled={status === "syncing"} variant="outline" size="sm">
                  {status === "syncing" ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Sincronizar vendas
                </Button>
                {integration.isExpired ? (
                  <Button onClick={handleLogin} variant="default" size="sm">
                    <Plug className="w-4 h-4 mr-2" />
                    Reconectar
                  </Button>
                ) : (
                  <Button onClick={handleDisconnect} variant="destructive" size="sm" className="ml-auto">
                    <LogOut className="w-4 h-4 mr-2" />
                    Desconectar
                  </Button>
                )}
              </div>

              {syncResult && syncResult.stats && (
                <div className="rounded-lg border border-gray-200 p-4 text-sm bg-gray-50">
                  <p className="font-semibold text-gray-900 mb-2 text-xs uppercase tracking-wide">Último resultado</p>
                  <div className="grid grid-cols-3 gap-2">
                    <StatBox label="Total" value={syncResult.stats.total} />
                    <StatBox label="Sincronizados" value={syncResult.stats.synced ?? syncResult.stats.created} cls="text-emerald-600" />
                    <StatBox label="Erros" value={syncResult.stats.failed ?? 0} cls="text-red-600" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border border-gray-200 p-4 bg-gray-50 text-sm text-gray-700 space-y-2">
                <p className="font-semibold text-gray-900">Como funciona a conexão?</p>
                <ul className="space-y-1 text-xs text-gray-600 list-disc pl-4">
                  <li>Você é redirecionado pro site do Mercado Livre.</li>
                  <li>Faz login na sua conta ML e autoriza o agLivre.</li>
                  <li>Voltamos aqui com o token — nunca vemos sua senha.</li>
                  <li>A sincronização começa automaticamente.</li>
                </ul>
              </div>

              <Button onClick={handleLogin} disabled={status === "loading"} className="w-full" size="lg">
                {status === "loading" ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <Plug className="w-4 h-4 mr-2" />}
                {status === "loading" ? "Redirecionando..." : "Conectar Mercado Livre"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Método avançado — token manual */}
      {!integration?.configured && <ManualTokenCard onSuccess={check} />}
    </div>
  )
}

interface AppCredentialsResponse {
  configured: boolean
  source: "tenant" | "env" | null
  clientId: string | null
  clientSecretMasked: string | null
  redirectUri: string
  updatedAt?: string
}

function AppCredentialsCard() {
  const [data, setData] = useState<AppCredentialsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const load = () => {
    setLoading(true)
    fetch("/api/ml/app-credentials")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const startEdit = () => {
    setEditing(true)
    setClientId("")
    setClientSecret("")
    setMsg(null)
  }

  const cancel = () => {
    setEditing(false)
    setClientId("")
    setClientSecret("")
    setMsg(null)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMsg(null)
    try {
      const res = await fetch("/api/ml/app-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg({ type: "success", text: "Credenciais salvas." })
        setEditing(false)
        load()
      } else {
        setMsg({ type: "error", text: d.error || "Erro ao salvar" })
      }
    } catch {
      setMsg({ type: "error", text: "Erro de conexão" })
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async () => {
    if (!confirm("Remover credenciais do seu app ML? Volta a usar o app padrão do agLivre.")) return
    try {
      await fetch("/api/ml/app-credentials", { method: "DELETE" })
      load()
    } catch {}
  }

  const copy = (text: string) => navigator.clipboard.writeText(text)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">App Mercado Livre</CardTitle>
            <CardDescription>
              Credenciais do app registrado no{" "}
              <a
                href="https://developers.mercadolivre.com.br/devcenter"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 underline"
              >
                ML DevCenter
              </a>
              .
            </CardDescription>
          </div>
          {!loading && data?.configured && !editing && (
            <Badge variant={data.source === "tenant" ? "default" : "secondary"}>
              {data.source === "tenant" ? "App próprio" : "App padrão agLivre"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {msg && <StatusMessage status={msg.type} message={msg.text} />}

        {loading ? (
          <LoadingBox />
        ) : editing ? (
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                placeholder="1234567890123456"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? "text" : "password"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  required
                  placeholder="••••••••••••••••"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
              <p className="font-semibold text-gray-900">Como obter:</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>
                  Acesse{" "}
                  <a
                    href="https://developers.mercadolivre.com.br/devcenter"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 underline"
                  >
                    ML DevCenter
                  </a>{" "}
                  → Criar aplicação
                </li>
                <li>Registre a Redirect URI mostrada abaixo</li>
                <li>Copie Client ID e Client Secret e cole aqui</li>
              </ol>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={cancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !clientId.trim() || !clientSecret.trim()} size="sm">
                {submitting && <Loader className="w-4 h-4 animate-spin mr-2" />}
                Salvar credenciais
              </Button>
            </div>
          </form>
        ) : data?.configured && data.source === "tenant" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Client ID</div>
                <div className="text-sm font-mono text-gray-900 mt-1">{data.clientId}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Client Secret</div>
                <div className="text-sm font-mono text-gray-900 mt-1">{data.clientSecretMasked}</div>
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Redirect URI (cadastre no DevCenter)</div>
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                <code className="flex-1 text-xs font-mono break-all">{data.redirectUri}</code>
                <button
                  onClick={() => copy(data.redirectUri)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap"
                >
                  Copiar
                </button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="destructive" size="sm" onClick={remove}>
                Remover
              </Button>
              <Button size="sm" onClick={startEdit}>
                Editar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm space-y-2">
              <p className="text-gray-900 font-medium">
                {data?.configured ? (
                  <>Usando o app padrão do agLivre. Cadastre seu próprio app pra ter rate limit isolado e a autorização mostrar o nome da sua empresa.</>
                ) : (
                  <>Nenhum app ML configurado — cadastre o seu pra ativar a conexão.</>
                )}
              </p>
              {data?.redirectUri && (
                <div className="text-xs text-gray-600">
                  Redirect URI a cadastrar no DevCenter:{" "}
                  <code className="font-mono text-xs break-all">{data.redirectUri}</code>
                </div>
              )}
            </div>
            <Button size="sm" onClick={startEdit}>
              Cadastrar meu app
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ManualTokenCard({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState("")

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    setSubmitting(true)
    setErr("")
    try {
      const res = await fetch("/api/mercadolivre/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token.trim() }),
      })
      const d = await res.json()
      if (!res.ok) {
        setErr(d.error || d.details || "Token inválido")
        return
      }
      setToken("")
      setOpen(false)
      onSuccess()
    } catch {
      setErr("Erro de conexão")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-between w-full text-left"
        >
          <div>
            <CardTitle className="text-base">Usar access_token manualmente</CardTitle>
            <CardDescription>
              Avançado: cole um token que você já tenha. Prefira OAuth sempre que possível.
            </CardDescription>
          </div>
          <span className="text-sm text-gray-400">{open ? "▲" : "▼"}</span>
        </button>
      </CardHeader>
      {open && (
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            {err && <StatusMessage status="error" message={err} />}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access token do ML</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="APP_USR-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Validamos o token em <code className="font-mono">/users/me</code> antes de salvar.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !token.trim()} size="sm">
                {submitting && <Loader className="w-4 h-4 animate-spin mr-2" />}
                Validar e salvar
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  )
}

function StatBox({ label, value, cls }: { label: string; value: number | string; cls?: string }) {
  return (
    <div className="bg-white rounded p-2 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${cls || "text-gray-900"}`}>{value}</p>
    </div>
  )
}

/* ------------------- ASSINATURA ------------------- */

type Status = "TRIAL" | "ACTIVE" | "PENDING" | "OVERDUE" | "CANCELED" | "EXPIRED"

const STATUS_LABELS: Record<Status, string> = {
  TRIAL: "Trial",
  ACTIVE: "Ativa",
  PENDING: "Aguardando pagamento",
  OVERDUE: "Em atraso",
  CANCELED: "Cancelada",
  EXPIRED: "Expirada",
}
const STATUS_STYLES: Record<Status, string> = {
  TRIAL: "bg-primary-100 text-primary-800",
  ACTIVE: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELED: "bg-gray-100 text-gray-800",
  EXPIRED: "bg-gray-100 text-gray-800",
}
const BILLING_LABELS: Record<string, string> = { PIX: "PIX", BOLETO: "Boleto", CREDIT_CARD: "Cartão de crédito" }

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR")
}

function AssinaturaPanel() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [canceling, setCanceling] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const load = () => {
    setLoading(true)
    fetch("/api/billing/subscription")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const onCancel = async () => {
    if (!confirm("Cancelar a assinatura? Você perderá acesso aos recursos do Pro.")) return
    setCanceling(true)
    setMsg(null)
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" })
      if (res.ok) {
        setMsg({ type: "success", text: "Assinatura cancelada." })
        load()
      } else {
        const d = await res.json().catch(() => ({}))
        setMsg({ type: "error", text: d.error || "Erro" })
      }
    } catch {
      setMsg({ type: "error", text: "Erro de conexão" })
    } finally {
      setCanceling(false)
    }
  }

  if (loading) return <LoadingBox />
  if (!data) return <div className="text-gray-500 text-sm p-4">Nenhuma assinatura encontrada.</div>

  const { subscription, plan, trialDaysLeft } = data
  const isPaid = subscription.plan !== "FREE"
  const canCancel = isPaid && (subscription.status === "ACTIVE" || subscription.status === "PENDING")

  return (
    <div className="space-y-4">
      {msg && <StatusMessage status={msg.type} message={msg.text} />}

      <Card>
        <CardHeader>
          <CardTitle>Assinatura</CardTitle>
          <CardDescription>Seu plano atual e dados de cobrança.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm text-gray-500">Plano</div>
              <div className="text-2xl font-bold text-gray-900">{plan.name}</div>
              {subscription.value != null && (
                <div className="text-sm text-gray-600">{formatCurrency(Number(subscription.value))} / mês</div>
              )}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[subscription.status as Status]}`}>
              {STATUS_LABELS[subscription.status as Status]}
            </span>
          </div>

          {subscription.status === "TRIAL" && trialDaysLeft !== null && (
            <div className="flex items-start gap-3 bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm">
              <Sparkles className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
              <div className="text-primary-900">
                <p className="font-semibold">Trial gratuito</p>
                <p className="mt-0.5">
                  {trialDaysLeft === 0
                    ? "Termina hoje."
                    : `Restam ${trialDaysLeft} dia${trialDaysLeft === 1 ? "" : "s"}.`}{" "}
                  Faça upgrade pra continuar sem interrupção.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
            <div>
              <div className="text-xs text-gray-500">Forma de pagamento</div>
              <div className="text-sm font-medium text-gray-900 mt-1">
                {subscription.billingType ? BILLING_LABELS[subscription.billingType] : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">
                {subscription.status === "TRIAL" ? "Trial até" : "Próxima cobrança"}
              </div>
              <div className="text-sm font-medium text-gray-900 mt-1">
                {formatDate(subscription.status === "TRIAL" ? subscription.trialEndsAt : subscription.currentPeriodEnd)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/admin/billing/planos"
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              {isPaid ? "Trocar de plano" : "Fazer upgrade"}
            </Link>
            <Link
              href="/admin/billing/faturas"
              className="border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50"
            >
              <FileText className="w-4 h-4" />
              Ver faturas
            </Link>
            {canCancel && (
              <button
                onClick={onCancel}
                disabled={canceling}
                className="border border-red-300 text-red-700 font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-50 disabled:opacity-50"
              >
                {canceling ? <Loader className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Cancelar
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ------------------- HELPERS ------------------- */

function LoadingBox() {
  return (
    <div className="flex items-center justify-center py-8 text-gray-500">
      <Loader className="animate-spin w-5 h-5 mr-2" />
      Carregando...
    </div>
  )
}

function StatusMessage({ status, message }: { status: "success" | "error"; message: string }) {
  const cls = status === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
  const Icon = status === "success" ? CheckCircle : AlertCircle
  return (
    <div className={`rounded-lg border p-3 flex items-start gap-2 text-sm mb-4 ${cls}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <p>{message}</p>
    </div>
  )
}
