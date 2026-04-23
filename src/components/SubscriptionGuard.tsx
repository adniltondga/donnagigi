"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Loader2, Sparkles } from "lucide-react"

interface SubResponse {
  subscription: {
    plan: "FREE" | "PRO"
    status: "TRIAL" | "ACTIVE" | "PENDING" | "OVERDUE" | "CANCELED" | "EXPIRED"
    trialEndsAt: string | null
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
      <div className="flex items-center justify-center min-h-[50vh] text-gray-500">
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
        <div className="bg-white rounded-xl border border-red-200 p-8 max-w-md text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Assinatura expirada</h2>
            <p className="text-sm text-gray-600 mt-1">
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
      <TrialBanner data={data} />
      {children}
    </>
  )
}

function TrialBanner({ data }: { data: SubResponse }) {
  if (data.subscription.status !== "TRIAL" || data.trialDaysLeft === null) {
    return null
  }
  if (data.trialDaysLeft > 7) return null // só mostra nos últimos 7 dias pra não poluir

  const urgent = data.trialDaysLeft <= 3
  return (
    <div
      className={`mb-6 rounded-lg px-4 py-3 flex items-center justify-between gap-4 ${
        urgent
          ? "bg-red-50 border border-red-200 text-red-900"
          : "bg-primary-50 border border-primary-200 text-primary-900"
      }`}
    >
      <div className="flex items-center gap-3 text-sm">
        <Sparkles className={`w-5 h-5 ${urgent ? "text-red-600" : "text-primary-600"}`} />
        <div>
          <p className="font-semibold">
            {data.trialDaysLeft === 0
              ? "Seu trial termina hoje!"
              : `Restam ${data.trialDaysLeft} dia${data.trialDaysLeft === 1 ? "" : "s"} de trial`}
          </p>
          <p className="text-xs opacity-80">
            Faça upgrade pro Pro pra continuar sem interrupção.
          </p>
        </div>
      </div>
      <Link
        href="/admin/billing/planos"
        className={`text-sm font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap ${
          urgent
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-primary-600 text-white hover:bg-primary-700"
        }`}
      >
        Upgrade agora
      </Link>
    </div>
  )
}
