"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, AlertTriangle, Loader2, Sparkles, XCircle } from "lucide-react"

interface SubResponse {
  subscription: {
    plan: "FREE" | "PRO"
    status: "TRIAL" | "ACTIVE" | "PENDING" | "OVERDUE" | "CANCELED" | "EXPIRED"
    trialEndsAt: string | null
    currentPeriodEnd: string | null
  }
  trialDaysLeft: number | null
  canUse: boolean
}

/**
 * Wrapper client-side que verifica a subscription do tenant no mount.
 *
 * - Se `canUse=true` renderiza `children` normalmente + banner de trial
 *   quando aplicável.
 * - Se `canUse=false` (trial expirado, EXPIRED, CANCELED sem plano) e
 *   a rota NÃO é /admin/billing/*, redireciona pra
 *   /admin/billing/assinatura.
 *
 * Rotas sempre liberadas (sem guard): /admin/login, /admin/billing/*
 */
export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [data, setData] = useState<SubResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const isPublicAdmin =
    pathname === "/admin/login" || pathname.startsWith("/admin/billing")

  useEffect(() => {
    if (isPublicAdmin) {
      setLoading(false)
      return
    }
    fetch("/api/billing/subscription")
      .then((r) => {
        if (r.status === 401) {
          // Sem sessão — middleware cuida do redirect
          return null
        }
        return r.ok ? r.json() : null
      })
      .then(setData)
      .finally(() => setLoading(false))
  }, [isPublicAdmin, pathname])

  useEffect(() => {
    if (!data || isPublicAdmin) return
    if (!data.canUse) {
      router.replace("/admin/billing/assinatura")
    }
  }, [data, isPublicAdmin, router])

  if (isPublicAdmin) return <>{children}</>

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Carregando...
      </div>
    )
  }

  // Sem data = não logado; o middleware já redireciona. Renderiza anyway.
  if (!data) return <>{children}</>

  if (!data.canUse) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-6">
        <div className="bg-card rounded-xl border border-red-200 p-8 max-w-md text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Assinatura expirada</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Seu trial ou assinatura não está mais ativo. Escolha um plano pra continuar usando o agLivre.
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <Link
              href="/admin/billing/planos"
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-lg"
            >
              Ver planos
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <BillingStatusBanner data={data} />
      {children}
    </>
  )
}

const fmtDate = (iso: string | null) => {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

type Tone = "info" | "warn" | "danger"

interface BannerContent {
  tone: Tone
  icon: React.ReactNode
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
}

function bannerForState(data: SubResponse): BannerContent | null {
  const { status } = data.subscription

  // TRIAL: só nos últimos 7 dias
  if (status === "TRIAL" && data.trialDaysLeft !== null) {
    if (data.trialDaysLeft > 7) return null
    const urgent = data.trialDaysLeft <= 3
    return {
      tone: urgent ? "danger" : "info",
      icon: <Sparkles className="w-5 h-5" />,
      title:
        data.trialDaysLeft === 0
          ? "Seu trial termina hoje!"
          : `Restam ${data.trialDaysLeft} dia${data.trialDaysLeft === 1 ? "" : "s"} de trial`,
      body: "Faça upgrade pro Pro pra continuar sem interrupção.",
      ctaLabel: "Ver planos",
      ctaHref: "/admin/billing/planos",
    }
  }

  // OVERDUE: pagamento atrasado, ASAAS está retentando
  if (status === "OVERDUE") {
    return {
      tone: "warn",
      icon: <AlertTriangle className="w-5 h-5" />,
      title: "Pagamento em atraso",
      body: "Sua última cobrança não foi paga. Atualize seu cartão pra evitar bloqueio.",
      ctaLabel: "Atualizar pagamento",
      ctaHref: "/admin/billing/assinatura",
    }
  }

  // CANCELED com period ainda válido: avisa data de corte
  if (status === "CANCELED" && data.subscription.currentPeriodEnd) {
    const endDate = new Date(data.subscription.currentPeriodEnd)
    if (endDate > new Date()) {
      return {
        tone: "info",
        icon: <XCircle className="w-5 h-5" />,
        title: `Assinatura cancelada — acesso até ${fmtDate(data.subscription.currentPeriodEnd)}`,
        body: "Você ainda tem acesso completo até essa data. Reative pra não perder nada.",
        ctaLabel: "Reativar",
        ctaHref: "/admin/billing/planos",
      }
    }
  }

  return null
}

function BillingStatusBanner({ data }: { data: SubResponse }) {
  const content = bannerForState(data)
  if (!content) return null

  const tones: Record<Tone, { wrap: string; iconColor: string; cta: string }> = {
    info: {
      wrap: "bg-primary-50 border-primary-200 text-primary-900",
      iconColor: "text-primary-600",
      cta: "bg-primary-600 text-white hover:bg-primary-700",
    },
    warn: {
      wrap: "bg-amber-50 border-amber-200 text-amber-900",
      iconColor: "text-amber-600",
      cta: "bg-amber-600 text-white hover:bg-amber-700",
    },
    danger: {
      wrap: "bg-red-50 border-red-200 text-red-900",
      iconColor: "text-red-600",
      cta: "bg-red-600 text-white hover:bg-red-700",
    },
  }
  const c = tones[content.tone]

  return (
    <div
      className={`mb-6 rounded-lg px-4 py-3 flex items-center justify-between gap-4 border ${c.wrap}`}
    >
      <div className="flex items-center gap-3 text-sm">
        <span className={c.iconColor}>{content.icon}</span>
        <div>
          <p className="font-semibold">{content.title}</p>
          <p className="text-xs opacity-80">{content.body}</p>
        </div>
      </div>
      <Link
        href={content.ctaHref}
        className={`text-sm font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap ${c.cta}`}
      >
        {content.ctaLabel}
      </Link>
    </div>
  )
}
