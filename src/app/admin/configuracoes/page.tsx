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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center text-2xl">
              🇧🇷
            </div>
            <div>
              <CardTitle>Mercado Livre</CardTitle>
              <CardDescription>Sincronize seus produtos e vendas automaticamente.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingBox />
          ) : integration?.configured ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="text-green-600 w-5 h-5" />
                  <span className="font-semibold text-green-900">Conectado</span>
                </div>
                <div className="space-y-1 text-green-800">
                  <p>
                    <span className="font-semibold">Seller ID:</span> {integration.sellerID}
                  </p>
                  {integration.expiresAt && (
                    <p>
                      <span className="font-semibold">Token expira em:</span>{" "}
                      {new Date(integration.expiresAt).toLocaleString("pt-BR")}
                    </p>
                  )}
                  {integration.isExpired && (
                    <p className="text-orange-600 font-semibold">
                      ⚠️ Token expirado — reconecte sua conta
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={syncProducts}
                  disabled={status === "syncing"}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {status === "syncing" ? <Loader className="animate-spin w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                  Sincronizar produtos
                </button>
                <button
                  onClick={syncOrders}
                  disabled={status === "syncing"}
                  className="bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {status === "syncing" ? <Loader className="animate-spin w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                  Sincronizar vendas
                </button>
              </div>

              <button
                onClick={handleDisconnect}
                className="w-full border border-red-300 hover:bg-red-50 text-red-700 font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Desconectar
              </button>

              {syncResult && syncResult.stats && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                  <p className="font-semibold text-blue-900 mb-2">📊 Resultado:</p>
                  <div className="grid grid-cols-3 gap-2">
                    <StatBox label="Total" value={syncResult.stats.total} />
                    <StatBox label="Sincronizados" value={syncResult.stats.synced ?? syncResult.stats.created} cls="text-emerald-600" />
                    <StatBox label="Erros" value={syncResult.stats.failed ?? 0} cls="text-red-600" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Conecte sua conta do Mercado Livre para começar a sincronizar produtos e vendas automaticamente.
              </p>
              <button
                onClick={handleLogin}
                disabled={status === "loading"}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2"
              >
                {status === "loading" && <Loader className="animate-spin w-4 h-4" />}
                {status === "loading" ? "Redirecionando..." : "Conectar Mercado Livre"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
