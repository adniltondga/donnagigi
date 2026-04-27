"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  User,
  KeyRound,
  Plug,
  CreditCard,
  Eye,
  EyeOff,
  Sparkles,
  FileText,
  XCircle,
  Users,
  Bell,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingState } from "@/components/ui/loading-state"
import { formatCurrency } from "@/lib/calculations"
import { useUserRole } from "@/lib/useUserRole"
import { EquipePanel } from "@/components/admin/EquipePanel"
import { IntegrationsPanel } from "@/components/admin/IntegrationsPanel"
import { PushNotificationButton } from "@/components/PushNotificationButton"
import { DeleteAccountSection } from "@/components/DeleteAccountSection"
import { ExportDataButton } from "@/components/ExportDataButton"
import { feedback } from "@/lib/feedback"
import { confirmDialog } from "@/components/ui/confirm-dialog"

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */

type Section =
  | "perfil"
  | "senha"
  | "notificacoes"
  | "equipe"
  | "integracoes"
  | "assinatura"
  | "conta"

interface NavItem {
  key: Section
  label: string
  description: string
  icon: LucideIcon
  /** Só visível pra OWNER/ADMIN. */
  writeOnly?: boolean
  /** Só visível pra OWNER (LGPD). */
  ownerOnly?: boolean
}

const NAV: NavItem[] = [
  { key: "perfil", label: "Perfil", description: "Seus dados e do negócio", icon: User },
  { key: "senha", label: "Senha", description: "Trocar a senha", icon: KeyRound },
  {
    key: "notificacoes",
    label: "Notificações",
    description: "Push no celular",
    icon: Bell,
  },
  {
    key: "equipe",
    label: "Equipe",
    description: "Convidar e gerenciar usuários",
    icon: Users,
    writeOnly: true,
  },
  {
    key: "integracoes",
    label: "Integrações",
    description: "Mercado Livre e Mercado Pago",
    icon: Plug,
    writeOnly: true,
  },
  {
    key: "assinatura",
    label: "Assinatura",
    description: "Plano e cobrança",
    icon: CreditCard,
    writeOnly: true,
  },
  {
    key: "conta",
    label: "Conta",
    description: "Exportar dados e excluir conta",
    icon: ShieldAlert,
    ownerOnly: true,
  },
]

/* ============================================================
   PÁGINA
   ============================================================ */

function ConfigInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { canWrite, isOwner } = useUserRole()
  const [section, setSection] = useState<Section>("perfil")

  const visibleNav = NAV.filter((n) => {
    if (n.writeOnly && !canWrite) return false
    if (n.ownerOnly && !isOwner) return false
    return true
  })

  useEffect(() => {
    // Aceita ?tab=ml como sinônimo de integracoes (compat com URLs antigas)
    const raw = params.get("tab") as string | null
    const aliasMap: Record<string, Section> = { ml: "integracoes" }
    const t = (raw && (aliasMap[raw] ?? (raw as Section))) || null
    if (t && visibleNav.some((x) => x.key === t)) setSection(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, canWrite, isOwner])

  // Tracking pós-OAuth
  useEffect(() => {
    const mlOk = params.get("success")
    const mpOk = params.get("mp_success")
    if (!mlOk && !mpOk) return
    void import("@/lib/analytics").then(({ trackEvent }) => {
      if (mlOk) trackEvent("ml_connected")
      if (mpOk) trackEvent("mp_connected")
    })
  }, [params])

  const switchSection = (s: Section) => {
    setSection(s)
    router.replace(`/admin/configuracoes?tab=${s}`, { scroll: false })
  }

  const current = visibleNav.find((n) => n.key === section) ?? visibleNav[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Conta, equipe, integrações e plano."
      />

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Sidebar (desktop) / horizontal scroll (mobile) */}
        <aside className="lg:w-64 lg:shrink-0">
          <nav
            className="
              flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible
              border-b lg:border-b-0 border-border lg:border-none pb-1 lg:pb-0
              -mx-2 px-2 lg:mx-0 lg:px-0
            "
          >
            {visibleNav.map((n) => {
              const Icon = n.icon
              const active = section === n.key
              return (
                <button
                  key={n.key}
                  type="button"
                  onClick={() => switchSection(n.key)}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm whitespace-nowrap
                    transition-colors text-left flex-shrink-0
                    ${
                      active
                        ? "bg-accent text-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }
                  `}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{n.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Conteúdo */}
        <main className="flex-1 min-w-0">
          {section === "perfil" && <PerfilPanel />}
          {section === "senha" && <SenhaPanel />}
          {section === "notificacoes" && <NotificacoesPanel />}
          {section === "equipe" && canWrite && <EquipePanel />}
          {section === "integracoes" && canWrite && (
            <IntegrationsPanel
              mlFlashSuccess={params.get("success")}
              mlFlashError={params.get("error")}
              mpFlashSuccess={params.get("mp_success")}
              mpFlashError={params.get("mp_error")}
            />
          )}
          {section === "assinatura" && canWrite && <AssinaturaPanel />}
          {section === "conta" && isOwner && <ContaPanel />}

          {/* Hint discreto da seção atual no rodapé do conteúdo (opcional) */}
          {current && (
            <p className="text-xs text-muted-foreground mt-4 lg:hidden">
              {current.description}
            </p>
          )}
        </main>
      </div>
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

/* ============================================================
   PERFIL
   ============================================================ */

function PerfilPanel() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [tenantName, setTenantName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tenantName }),
      })
      await feedback.fromResponse(res, "Perfil atualizado.")
    } catch {
      feedback.error("Erro de conexão")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState variant="card" />

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
        <CardDescription>Seus dados pessoais e o nome do negócio.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSave} className="space-y-5 max-w-xl">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Nome completo</Label>
            <Input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" type="email" value={email} disabled />
            <p className="text-xs text-muted-foreground">
              Email não pode ser alterado.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-tenant">Nome do negócio</Label>
            <Input
              id="profile-tenant"
              type="text"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
              minLength={2}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

/* ============================================================
   SENHA
   ============================================================ */

function SenhaPanel() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    if (next !== confirm) {
      setValidationError("As senhas não conferem")
      return
    }
    if (next.length < 6) {
      setValidationError("A nova senha precisa ter ao menos 6 caracteres")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const ok = await feedback.fromResponse(res, "Senha alterada com sucesso.")
      if (ok) {
        setCurrent("")
        setNext("")
        setConfirm("")
      }
    } catch {
      feedback.error("Erro de conexão")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Senha</CardTitle>
        <CardDescription>
          Troque a senha periodicamente pra manter a conta segura.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5 max-w-xl">
          <PasswordField
            id="pwd-current"
            label="Senha atual"
            value={current}
            onChange={setCurrent}
            show={show}
            toggleShow={() => setShow((v) => !v)}
            required
          />
          <PasswordField
            id="pwd-next"
            label="Nova senha"
            value={next}
            onChange={setNext}
            show={show}
            toggleShow={() => setShow((v) => !v)}
            hint="Mínimo 6 caracteres"
            required
            minLength={6}
          />
          <PasswordField
            id="pwd-confirm"
            label="Confirmar nova senha"
            value={confirm}
            onChange={setConfirm}
            show={show}
            toggleShow={() => setShow((v) => !v)}
            required
            minLength={6}
          />

          {validationError && (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {validationError}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Trocar senha"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  toggleShow,
  hint,
  required,
  minLength,
}: {
  id: string
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
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          className="pr-10"
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/* ============================================================
   NOTIFICAÇÕES
   ============================================================ */

function NotificacoesPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificações</CardTitle>
        <CardDescription>
          Receba ping no celular toda venda nova, devolução ou liberação do
          Mercado Pago. Funciona melhor com o agLivre instalado como app (PWA).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PushNotificationButton />
      </CardContent>
    </Card>
  )
}

/* ============================================================
   ASSINATURA
   ============================================================ */

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
  TRIAL: "bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  OVERDUE: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  CANCELED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  EXPIRED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
}
const BILLING_LABELS: Record<string, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR")
}

interface SubscriptionData {
  subscription: {
    plan: "FREE" | "PRO"
    status: Status
    value: number | null
    billingType: string | null
    trialEndsAt: string | null
    currentPeriodEnd: string | null
  }
  plan: { name: string }
  trialDaysLeft: number | null
}

function AssinaturaPanel() {
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [canceling, setCanceling] = useState(false)

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
    const ok = await confirmDialog({
      title: "Cancelar assinatura?",
      description: "Você manterá acesso aos recursos do Pro até o fim do ciclo atual.",
      confirmLabel: "Sim, cancelar",
      cancelLabel: "Voltar",
      variant: "danger",
    })
    if (!ok) return
    setCanceling(true)
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" })
      const okResp = await feedback.fromResponse(res, "Assinatura cancelada.")
      if (okResp) load()
    } catch {
      feedback.error("Erro de conexão")
    } finally {
      setCanceling(false)
    }
  }

  if (loading) return <LoadingState variant="card" />
  if (!data) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground py-8">
          Nenhuma assinatura encontrada.
        </CardContent>
      </Card>
    )
  }

  const { subscription, plan, trialDaysLeft } = data
  const isPaid = subscription.plan !== "FREE"
  const canCancel = isPaid && (subscription.status === "ACTIVE" || subscription.status === "PENDING")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assinatura</CardTitle>
        <CardDescription>Seu plano atual e dados de cobrança.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Plano
            </div>
            <div className="text-2xl font-bold text-foreground mt-1">{plan.name}</div>
            {subscription.value != null && (
              <div className="text-sm text-muted-foreground mt-0.5">
                {formatCurrency(Number(subscription.value))} / mês
              </div>
            )}
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[subscription.status]}`}
          >
            {STATUS_LABELS[subscription.status]}
          </span>
        </div>

        {subscription.status === "TRIAL" && trialDaysLeft !== null && (
          <div className="flex items-start gap-3 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-900/50 rounded-lg p-3 text-sm">
            <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
            <div className="text-primary-900 dark:text-primary-100">
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

        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Forma de pagamento
            </div>
            <div className="text-sm font-medium text-foreground mt-1">
              {subscription.billingType ? BILLING_LABELS[subscription.billingType] : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {subscription.status === "TRIAL" ? "Trial até" : "Próxima cobrança"}
            </div>
            <div className="text-sm font-medium text-foreground mt-1">
              {formatDate(
                subscription.status === "TRIAL"
                  ? subscription.trialEndsAt
                  : subscription.currentPeriodEnd,
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild>
            <Link href="/admin/billing/planos">
              <CreditCard className="w-4 h-4" />
              {isPaid ? "Trocar de plano" : "Fazer upgrade"}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/billing/faturas">
              <FileText className="w-4 h-4" />
              Ver faturas
            </Link>
          </Button>
          {canCancel && (
            <Button variant="outline" onClick={onCancel} disabled={canceling}>
              <XCircle className="w-4 h-4" />
              {canceling ? "Cancelando..." : "Cancelar"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/* ============================================================
   CONTA (LGPD — destrutivo)
   ============================================================ */

function ContaPanel() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Exportar dados</CardTitle>
          <CardDescription>
            Baixe um arquivo com todos os seus dados — vendas, contas, integrações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportDataButton />
        </CardContent>
      </Card>

      <Card className="border-rose-200 dark:border-rose-900/50">
        <CardHeader>
          <CardTitle className="text-rose-700 dark:text-rose-400">
            Excluir conta
          </CardTitle>
          <CardDescription>
            Apaga sua conta e todos os dados em até 30 dias. Você pode reativar
            antes desse prazo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountSection />
        </CardContent>
      </Card>
    </div>
  )
}
