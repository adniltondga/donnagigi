"use client"

import { useEffect, useState } from "react"
import {
  Plug,
  CheckCircle,
  AlertCircle,
  Loader,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw,
  Wallet,
  ShoppingBag,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/* ============================================================
   INTEGRATIONS GRID
   ============================================================ */

interface IntegrationStatus {
  configured: boolean
  isExpired?: boolean
  identifier?: string // sellerID (ML) ou mpUserId (MP)
}

interface IntegrationsPanelProps {
  mpFlashSuccess?: string | null
  mpFlashError?: string | null
  mlFlashSuccess?: string | null
  mlFlashError?: string | null
}

export function IntegrationsPanel({
  mpFlashSuccess,
  mpFlashError,
  mlFlashSuccess,
  mlFlashError,
}: IntegrationsPanelProps) {
  const [ml, setMl] = useState<IntegrationStatus | null>(null)
  const [mp, setMp] = useState<IntegrationStatus | null>(null)
  const [openModal, setOpenModal] = useState<"ml" | "mp" | null>(null)
  const [globalMsg, setGlobalMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  )

  const loadStatuses = async () => {
    const [mlRes, mpRes] = await Promise.all([
      fetch("/api/mercadolivre/integration").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/mp/integration").then((r) => (r.ok ? r.json() : null)),
    ])
    setMl(
      mlRes
        ? {
            configured: mlRes.configured,
            isExpired: mlRes.isExpired,
            identifier: mlRes.sellerID,
          }
        : { configured: false }
    )
    setMp(
      mpRes
        ? {
            configured: mpRes.configured,
            isExpired: mpRes.isExpired,
            identifier: mpRes.mpUserId,
          }
        : { configured: false }
    )
  }

  useEffect(() => {
    loadStatuses()
  }, [])

  // Mensagens vindas via query string (callback OAuth)
  useEffect(() => {
    if (mpFlashSuccess) setGlobalMsg({ type: "success", text: decodeURIComponent(mpFlashSuccess) })
    else if (mpFlashError) setGlobalMsg({ type: "error", text: decodeURIComponent(mpFlashError) })
    else if (mlFlashSuccess) setGlobalMsg({ type: "success", text: decodeURIComponent(mlFlashSuccess) })
    else if (mlFlashError) setGlobalMsg({ type: "error", text: decodeURIComponent(mlFlashError) })
  }, [mpFlashSuccess, mpFlashError, mlFlashSuccess, mlFlashError])

  return (
    <div className="space-y-4">
      {globalMsg && <StatusMessage status={globalMsg.type} message={globalMsg.text} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <IntegrationCard
          title="Mercado Livre"
          subtitle="Sincroniza vendas, produtos e taxas do seu seller ML."
          icon={<ShoppingBag className="w-6 h-6" />}
          accent="bg-amber-50 text-amber-700 border-amber-100"
          status={ml}
          identifierLabel="Seller ID"
          onClick={() => setOpenModal("ml")}
        />
        <IntegrationCard
          title="Mercado Pago"
          subtitle="Acompanha o saldo, recebimentos e movimentos da sua conta MP."
          icon={<Wallet className="w-6 h-6" />}
          accent="bg-sky-50 text-sky-700 border-sky-100"
          status={mp}
          identifierLabel="User ID MP"
          onClick={() => setOpenModal("mp")}
        />
      </div>

      <MercadoLivreDialog
        open={openModal === "ml"}
        onClose={() => {
          setOpenModal(null)
          loadStatuses()
        }}
        onFlash={(type, text) => setGlobalMsg({ type, text })}
      />
      <MercadoPagoDialog
        open={openModal === "mp"}
        onClose={() => {
          setOpenModal(null)
          loadStatuses()
        }}
        onFlash={(type, text) => setGlobalMsg({ type, text })}
      />
    </div>
  )
}

function IntegrationCard({
  title,
  subtitle,
  icon,
  accent,
  status,
  identifierLabel,
  onClick,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  accent: string
  status: IntegrationStatus | null
  identifierLabel: string
  onClick: () => void
}) {
  const loading = status === null
  const isConnected = status?.configured && !status?.isExpired
  const isExpired = status?.configured && status?.isExpired

  return (
    <button onClick={onClick} className="text-left group">
      <Card className="hover:shadow-md hover:border-primary-200 transition h-full">
        <CardContent className="flex items-start gap-4 pt-5">
          <div className={`w-12 h-12 rounded-lg border flex items-center justify-center flex-shrink-0 ${accent}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-600 transition">
                {title}
              </h3>
              {loading ? (
                <Badge variant="secondary" className="text-xs">
                  ...
                </Badge>
              ) : isConnected ? (
                <Badge className="text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  Conectado
                </Badge>
              ) : isExpired ? (
                <Badge variant="destructive" className="text-xs">
                  Token expirado
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Não conectado
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{subtitle}</p>
            {status?.configured && status.identifier && (
              <p className="text-xs text-gray-400 mt-2 font-mono">
                {identifierLabel}: {status.identifier}
              </p>
            )}
            <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary-600 font-semibold opacity-0 group-hover:opacity-100 transition">
              Configurar <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

/* ============================================================
   MERCADO LIVRE DIALOG
   ============================================================ */

interface MLCredsResponse {
  configured: boolean
  source: "tenant" | "env" | null
  clientId: string | null
  clientSecretMasked: string | null
  redirectUri: string
  customRedirectUri?: string | null
}

interface MLIntegrationResponse {
  configured: boolean
  sellerID?: string
  expiresAt?: string
  isExpired?: boolean
}

function MercadoLivreDialog({
  open,
  onClose,
  onFlash,
}: {
  open: boolean
  onClose: () => void
  onFlash: (t: "success" | "error", msg: string) => void
}) {
  const [creds, setCreds] = useState<MLCredsResponse | null>(null)
  const [integration, setIntegration] = useState<MLIntegrationResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [c, i] = await Promise.all([
        fetch("/api/ml/app-credentials").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/mercadolivre/integration").then((r) => (r.ok ? r.json() : null)),
      ])
      setCreds(c)
      setIntegration(i)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  const handleDisconnect = async () => {
    if (!confirm("Desconectar a integração com Mercado Livre?")) return
    const res = await fetch("/api/mercadolivre/integration", { method: "DELETE" })
    if (res.ok) {
      onFlash("success", "Desconectado do Mercado Livre")
      load()
    } else {
      onFlash("error", "Erro ao desconectar")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-600" />
            Mercado Livre
          </DialogTitle>
          <DialogDescription>
            Registre seu app no{" "}
            <a
              href="https://developers.mercadolivre.com.br/devcenter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 underline"
            >
              ML DevCenter
            </a>
            , cole as credenciais e conecte sua conta de vendedor.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <LoadingBox />
        ) : (
          <div className="space-y-6">
            <MLCredentialsSection data={creds} onChanged={load} onFlash={onFlash} />
            <div className="border-t border-gray-100" />
            <MLConnectionSection
              integration={integration}
              onDisconnect={handleDisconnect}
              onFlash={onFlash}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MLCredentialsSection({
  data,
  onChanged,
  onFlash,
}: {
  data: MLCredsResponse | null
  onChanged: () => void
  onFlash: (t: "success" | "error", msg: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [redirectUri, setRedirectUri] = useState("")
  const [showSecret, setShowSecret] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const startEdit = () => {
    setEditing(true)
    setClientId("")
    setClientSecret("")
    setRedirectUri(data?.customRedirectUri || "")
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch("/api/ml/app-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          redirectUri: redirectUri.trim() || null,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        onFlash("success", "Credenciais salvas.")
        setEditing(false)
        onChanged()
      } else {
        onFlash("error", d.error || "Erro ao salvar")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async () => {
    if (!confirm("Remover credenciais do seu app ML? Volta a usar o app padrão do agLivre.")) return
    await fetch("/api/ml/app-credentials", { method: "DELETE" })
    onFlash("success", "Credenciais removidas")
    onChanged()
  }

  const copy = (text: string) => navigator.clipboard.writeText(text)
  const hasOwn = data?.configured && data.source === "tenant"

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">App Mercado Livre</h4>
          <p className="text-xs text-gray-500">Credenciais do app registrado no ML DevCenter.</p>
        </div>
        {!editing && data?.configured && (
          <Badge variant={hasOwn ? "default" : "secondary"} className="text-xs">
            {hasOwn ? "App próprio" : "App padrão"}
          </Badge>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="space-y-3">
          <Field label="Client ID" value={clientId} onChange={setClientId} placeholder="1234567890123456" mono />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Client Secret</label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                required
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-600 outline-none"
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
          <Field
            label="Redirect URI (opcional)"
            value={redirectUri}
            onChange={setRedirectUri}
            placeholder={data?.redirectUri || "https://seudominio/api/ml/oauth/callback"}
            mono
          />
          <p className="text-xs text-gray-500">
            Esta URI precisa estar cadastrada no app do ML DevCenter. Padrão:{" "}
            <code className="font-mono">{data?.redirectUri || "—"}</code>
          </p>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !clientId.trim() || !clientSecret.trim()} size="sm">
              {submitting && <Loader className="w-4 h-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </form>
      ) : hasOwn ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Client ID</div>
              <div className="font-mono text-gray-900 mt-1">{data.clientId}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Secret</div>
              <div className="font-mono text-gray-900 mt-1">{data.clientSecretMasked}</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Redirect URI (cadastre no DevCenter)</div>
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
              <code className="flex-1 text-xs font-mono break-all">{data.redirectUri}</code>
              <button
                onClick={() => copy(data.redirectUri)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap"
              >
                Copiar
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startEdit}>
              Editar
            </Button>
            <Button variant="destructive" size="sm" onClick={remove}>
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            {data?.configured
              ? "Usando o app padrão do agLivre. Cadastre seu app pra ter cotas isoladas."
              : "Nenhum app cadastrado. Registre no ML DevCenter e cole as credenciais."}
          </div>
          <Button size="sm" onClick={startEdit}>
            Cadastrar app próprio
          </Button>
        </div>
      )}
    </section>
  )
}

function MLConnectionSection({
  integration,
  onDisconnect,
  onFlash,
}: {
  integration: MLIntegrationResponse | null
  onDisconnect: () => void
  onFlash: (t: "success" | "error", msg: string) => void
}) {
  const [syncing, setSyncing] = useState<null | "orders" | "products">(null)

  const runSync = async (kind: "orders" | "products") => {
    if (syncing) return
    setSyncing(kind)
    try {
      const url = kind === "orders" ? "/api/ml/sync-orders" : "/api/ml/sync"
      const res = await fetch(url, { method: "GET" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        onFlash("error", data?.error || `Falha ao sincronizar ${kind === "orders" ? "vendas" : "produtos"}`)
        return
      }
      const stats = data?.stats
      const label = kind === "orders" ? "Vendas" : "Produtos"
      const detail = stats
        ? ` · ${stats.synced ?? stats.created ?? stats.total ?? 0} itens`
        : ""
      onFlash("success", `${label} sincronizados${detail}`)
    } catch (err) {
      onFlash("error", err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setSyncing(null)
    }
  }

  if (!integration?.configured) {
    return (
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">Conectar conta</h4>
        <p className="text-xs text-gray-500">
          Autorize o agLivre a acessar sua conta ML. Você será redirecionado pro site do Mercado Livre.
        </p>
        <Button className="w-full" onClick={() => (window.location.href = "/api/ml/oauth/login")}>
          <Plug className="w-4 h-4 mr-2" />
          Conectar Mercado Livre
        </Button>
      </section>
    )
  }

  const expired = integration.isExpired
  return (
    <section className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-900">Conexão ativa</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Seller ID</div>
          <div className="font-mono font-semibold text-gray-900 mt-1">{integration.sellerID}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            {expired ? "Expirou em" : "Válido até"}
          </div>
          <div className="font-medium text-gray-900 mt-1">
            {integration.expiresAt ? new Date(integration.expiresAt).toLocaleString("pt-BR") : "—"}
          </div>
        </div>
      </div>

      {!expired && (
        <>
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-900 space-y-1">
            <p className="font-semibold">🤖 Sincronização automática ativa</p>
            <p>
              O sistema puxa vendas, taxas e liberações do ML todo dia às 03:00 (horário BR). Normalmente
              você não precisa clicar aqui — use só pra forçar uma atualização imediata.
            </p>
          </div>
          <WebhookHint
            label="Webhook ML (tempo real)"
            path="/api/ml/webhook"
            instructions={
              <>
                No <a href="https://developers.mercadolivre.com.br/devcenter" target="_blank" rel="noopener noreferrer" className="underline">DevCenter</a>, abra seu app → <strong>Tópicos</strong> → cadastre essa URL e marque <code>orders_v2</code> e <code>items</code>. Assim cada venda cai no sistema em segundos.
              </>
            }
          />
        </>
      )}

      {expired ? (
        <Button className="w-full" onClick={() => (window.location.href = "/api/ml/oauth/login")}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Reconectar
        </Button>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => runSync("orders")}
              disabled={syncing !== null}
              className="border-sky-300 text-sky-700 hover:bg-sky-50"
            >
              {syncing === "orders" ? (
                <Loader className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sincronizar vendas
            </Button>
            <Button
              variant="outline"
              onClick={() => runSync("products")}
              disabled={syncing !== null}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              {syncing === "products" ? (
                <Loader className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sincronizar produtos
            </Button>
          </div>
          <Button variant="destructive" size="sm" onClick={onDisconnect} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Desconectar
          </Button>
        </>
      )}
    </section>
  )
}

/* ============================================================
   MERCADO PAGO DIALOG
   ============================================================ */

interface MPCredsResponse {
  configured: boolean
  source: "tenant" | "env" | null
  clientId: string | null
  clientSecretMasked: string | null
  redirectUri: string
  customRedirectUri?: string | null
}

interface MPIntegrationResponse {
  configured: boolean
  mpUserId?: string
  expiresAt?: string
  isExpired?: boolean
  scope?: string
}

function MercadoPagoDialog({
  open,
  onClose,
  onFlash,
}: {
  open: boolean
  onClose: () => void
  onFlash: (t: "success" | "error", msg: string) => void
}) {
  const [creds, setCreds] = useState<MPCredsResponse | null>(null)
  const [integration, setIntegration] = useState<MPIntegrationResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [c, i] = await Promise.all([
        fetch("/api/mp/app-credentials").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/mp/integration").then((r) => (r.ok ? r.json() : null)),
      ])
      setCreds(c)
      setIntegration(i)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  const handleDisconnect = async () => {
    if (!confirm("Desconectar a integração com Mercado Pago?")) return
    const res = await fetch("/api/mp/integration", { method: "DELETE" })
    if (res.ok) {
      onFlash("success", "Desconectado do Mercado Pago")
      load()
    } else {
      onFlash("error", "Erro ao desconectar")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-sky-600" />
            Mercado Pago
          </DialogTitle>
          <DialogDescription>
            Registre seu app no{" "}
            <a
              href="https://www.mercadopago.com.br/developers/panel/app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 underline"
            >
              MP DevCenter
            </a>{" "}
            e autorize o acesso ao seu saldo e movimentos.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <LoadingBox />
        ) : (
          <div className="space-y-6">
            <MPCredentialsSection data={creds} onChanged={load} onFlash={onFlash} />
            <div className="border-t border-gray-100" />
            <MPConnectionSection integration={integration} onDisconnect={handleDisconnect} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MPCredentialsSection({
  data,
  onChanged,
  onFlash,
}: {
  data: MPCredsResponse | null
  onChanged: () => void
  onFlash: (t: "success" | "error", msg: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [redirectUri, setRedirectUri] = useState("")
  const [showSecret, setShowSecret] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const startEdit = () => {
    setEditing(true)
    setClientId("")
    setClientSecret("")
    setRedirectUri(data?.customRedirectUri || "")
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch("/api/mp/app-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          redirectUri: redirectUri.trim() || null,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        onFlash("success", "Credenciais MP salvas.")
        setEditing(false)
        onChanged()
      } else {
        onFlash("error", d.error || "Erro ao salvar")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async () => {
    if (!confirm("Remover credenciais MP?")) return
    await fetch("/api/mp/app-credentials", { method: "DELETE" })
    onFlash("success", "Credenciais removidas")
    onChanged()
  }

  const copy = (text: string) => navigator.clipboard.writeText(text)
  const hasOwn = data?.configured && data.source === "tenant"

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">App Mercado Pago</h4>
          <p className="text-xs text-gray-500">Credenciais do app registrado no MP DevCenter.</p>
        </div>
        {!editing && data?.configured && (
          <Badge variant={hasOwn ? "default" : "secondary"} className="text-xs">
            {hasOwn ? "App próprio" : "App padrão"}
          </Badge>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="space-y-3">
          <Field label="APP ID / Client ID" value={clientId} onChange={setClientId} placeholder="1234567890123456" mono />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Secret Key / Client Secret</label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                required
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-600 outline-none"
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
          <Field
            label="Redirect URI (opcional)"
            value={redirectUri}
            onChange={setRedirectUri}
            placeholder={data?.redirectUri || "https://seudominio/api/mp/oauth/callback"}
            mono
          />
          <p className="text-xs text-gray-500">
            Cadastre essa URI no seu app MP. Padrão:{" "}
            <code className="font-mono">{data?.redirectUri || "—"}</code>
          </p>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !clientId.trim() || !clientSecret.trim()} size="sm">
              {submitting && <Loader className="w-4 h-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </form>
      ) : hasOwn ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">APP ID</div>
              <div className="font-mono text-gray-900 mt-1">{data.clientId}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Secret</div>
              <div className="font-mono text-gray-900 mt-1">{data.clientSecretMasked}</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Redirect URI (cadastre no MP)</div>
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
              <code className="flex-1 text-xs font-mono break-all">{data.redirectUri}</code>
              <button
                onClick={() => copy(data.redirectUri)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap"
              >
                Copiar
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startEdit}>
              Editar
            </Button>
            <Button variant="destructive" size="sm" onClick={remove}>
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            Nenhum app cadastrado. Cadastre APP ID + Secret Key do seu app MP.
          </div>
          <Button size="sm" onClick={startEdit}>
            Cadastrar app
          </Button>
        </div>
      )}
    </section>
  )
}

function MPConnectionSection({
  integration,
  onDisconnect,
}: {
  integration: MPIntegrationResponse | null
  onDisconnect: () => void
}) {
  if (!integration?.configured) {
    return (
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">Conectar conta</h4>
        <p className="text-xs text-gray-500">
          Autorize o agLivre a acessar sua conta MP. Você será redirecionado pro site do Mercado Pago.
        </p>
        <Button className="w-full" onClick={() => (window.location.href = "/api/mp/oauth/login")}>
          <Plug className="w-4 h-4 mr-2" />
          Conectar Mercado Pago
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-900">Conexão ativa</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">User ID MP</div>
          <div className="font-mono font-semibold text-gray-900 mt-1">{integration.mpUserId}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            {integration.isExpired ? "Expirou em" : "Válido até"}
          </div>
          <div className="font-medium text-gray-900 mt-1">
            {integration.expiresAt ? new Date(integration.expiresAt).toLocaleString("pt-BR") : "—"}
          </div>
        </div>
      </div>
      {!integration.isExpired && (
        <WebhookHint
          label="Webhook MP (tempo real)"
          path="/api/mercadopago/webhook"
          instructions={
            <>
              No <a href="https://www.mercadopago.com.br/developers/panel" target="_blank" rel="noopener noreferrer" className="underline">painel MP Developers</a>, abra seu app → <strong>Notificações &gt; Webhooks</strong> → cadastre essa URL e marque o evento <code>payment</code>. Assim liberações e disputas atualizam automaticamente.
            </>
          }
        />
      )}
      <div className="flex gap-2">
        {integration.isExpired ? (
          <Button className="flex-1" onClick={() => (window.location.href = "/api/mp/oauth/login")}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reconectar
          </Button>
        ) : (
          <Button variant="destructive" size="sm" onClick={onDisconnect}>
            <LogOut className="w-4 h-4 mr-2" />
            Desconectar
          </Button>
        )}
      </div>
    </section>
  )
}

function WebhookHint({
  label,
  path,
  instructions,
}: {
  label: string
  path: string
  instructions: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${path}` : path
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 space-y-2">
      <p className="font-semibold text-gray-900">📡 {label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[11px] font-mono break-all">
          {fullUrl}
        </code>
        <button
          onClick={copy}
          className="shrink-0 text-[11px] font-medium bg-gray-900 hover:bg-gray-700 text-white px-2.5 py-1 rounded"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="text-[11px] text-gray-600 leading-relaxed">{instructions}</p>
    </div>
  )
}

/* ============================================================
   SHARED HELPERS
   ============================================================ */

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 outline-none ${mono ? "font-mono" : ""}`}
      />
    </div>
  )
}

function LoadingBox() {
  return (
    <div className="flex items-center justify-center py-8 text-gray-500">
      <Loader className="w-5 h-5 animate-spin mr-2" />
      Carregando...
    </div>
  )
}

function StatusMessage({ status, message }: { status: "success" | "error"; message: string }) {
  const cls =
    status === "success"
      ? "bg-green-50 border-green-200 text-green-800"
      : "bg-red-50 border-red-200 text-red-800"
  const Icon = status === "success" ? CheckCircle : AlertCircle
  return (
    <div className={`rounded-lg border p-3 flex items-start gap-2 text-sm ${cls}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <p>{message}</p>
    </div>
  )
}
