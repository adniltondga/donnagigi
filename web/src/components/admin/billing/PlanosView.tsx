"use client"

import { useEffect, useState } from "react"
import { ArrowRight, Check, Loader2, X, Sparkles } from "lucide-react"
import { formatCurrency } from "@/lib/calculations"
import { feedback } from "@/lib/feedback"
import { maskCpfCnpj, unmaskCpfCnpj } from "@/lib/mask"
import { LoadingState } from "@/components/ui/loading-state"

type PlanId = "FREE" | "PRO" | "BUSINESS" | "ENTERPRISE"
type CheckoutablePlan = "PRO" | "BUSINESS"

interface PlanInfo {
  id: PlanId
  name: string
  tagline: string
  priceBRL: number
  features: string[]
  popular?: boolean
  contactOnly?: boolean
  priceLabel?: string
  contactHref?: string
}

type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD"

const BILLING_LABELS: Record<BillingType, string> = {
  PIX: "PIX",
  BOLETO: "Boleto bancário",
  CREDIT_CARD: "Cartão de crédito",
}

interface PlanosViewProps {
  /** Chamado quando o checkout dá certo. Útil pra recarregar a aba de assinatura. */
  onSuccess?: () => void
}

/**
 * Cards de planos + modal de checkout. Reutilizável em página dedicada
 * (/admin/billing/planos) e inline na aba Assinatura.
 */
export function PlanosView({ onSuccess }: PlanosViewProps) {
  const [plans, setPlans] = useState<PlanInfo[] | null>(null)
  const [currentPlan, setCurrentPlan] = useState<PlanId | null>(null)
  const [selected, setSelected] = useState<CheckoutablePlan | null>(null)
  const [loading, setLoading] = useState(true)

  const [cpfCnpj, setCpfCnpj] = useState("")
  const [billingType, setBillingType] = useState<BillingType>("PIX")
  const [mobilePhone, setMobilePhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/plans").then((r) => r.json()),
      fetch("/api/billing/subscription").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([plansRes, subRes]) => {
        setPlans(plansRes.data || [])
        if (subRes?.subscription?.plan) setCurrentPlan(subRes.subscription.plan)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const closeModal = () => {
    setSelected(null)
    setCpfCnpj("")
    setBillingType("PIX")
    setMobilePhone("")
    setError("")
  }

  const onCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const raw = unmaskCpfCnpj(cpfCnpj)
    if (raw.length !== 11 && raw.length !== 14) {
      setError("CPF/CNPJ inválido")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selected,
          billingType,
          cpfCnpj: raw,
          mobilePhone: mobilePhone || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        feedback.error(data.error || "Erro ao processar")
        return
      }
      feedback.success("Assinatura criada — abrindo cobrança…")
      const first = data.payments?.[0]
      if (first?.invoiceUrl) {
        window.open(first.invoiceUrl, "_blank")
      }
      closeModal()
      onSuccess?.()
    } catch {
      feedback.error("Erro ao conectar")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingState label="Carregando planos..." />
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {(plans || []).map((p) => {
          const isCurrent = currentPlan === p.id
          const isFree = p.id === "FREE"
          const isContactOnly = !!p.contactOnly
          return (
            <div
              key={p.id}
              className={`relative rounded-2xl p-6 flex flex-col border ${
                p.popular
                  ? "bg-gradient-to-br from-primary-600 to-fuchsia-700 text-white border-primary-600 shadow-xl"
                  : "bg-card border-border"
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Mais popular
                </div>
              )}

              <div className="mb-4">
                <h3 className={`text-xl font-bold ${p.popular ? "text-white" : "text-foreground"}`}>
                  {p.name}
                </h3>
                <p className={`text-sm mt-1 ${p.popular ? "text-primary-100" : "text-muted-foreground"}`}>
                  {p.tagline}
                </p>
              </div>

              <div className="mb-6">
                <span className={`text-4xl font-bold ${p.popular ? "text-white" : "text-foreground"}`}>
                  {p.priceLabel
                    ? p.priceLabel
                    : p.priceBRL === 0
                      ? "Grátis"
                      : formatCurrency(p.priceBRL)}
                </span>
                {!p.priceLabel && p.priceBRL > 0 && (
                  <span className={`text-sm ml-1 ${p.popular ? "text-primary-100" : "text-muted-foreground"}`}>
                    /mês
                  </span>
                )}
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        p.popular ? "text-primary-200" : "text-primary-600"
                      }`}
                    />
                    <span className={p.popular ? "text-primary-50" : "text-foreground"}>{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button
                  disabled
                  className={`w-full py-2.5 rounded-lg font-semibold ${
                    p.popular
                      ? "bg-white/20 text-white cursor-not-allowed"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  Plano atual
                </button>
              ) : isFree ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-lg font-semibold bg-muted text-muted-foreground cursor-not-allowed"
                >
                  Plano grátis
                </button>
              ) : isContactOnly ? (
                <a
                  href={p.contactHref || "mailto:comercial@dgadigital.com.br"}
                  className={`w-full py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                    p.popular
                      ? "bg-white text-primary-700 hover:bg-primary-50"
                      : "bg-primary-600 text-white hover:bg-primary-700"
                  }`}
                >
                  Falar com a gente
                  <ArrowRight className="w-4 h-4" />
                </a>
              ) : (
                <button
                  onClick={() => setSelected(p.id as CheckoutablePlan)}
                  className={`w-full py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                    p.popular
                      ? "bg-white text-primary-700 hover:bg-primary-50"
                      : "bg-primary-600 text-white hover:bg-primary-700"
                  }`}
                >
                  Assinar {p.name}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                {(() => {
                  const sel = plans?.find((p) => p.id === selected)
                  return (
                    <>
                      <h2 className="text-xl font-bold text-foreground">
                        Assinar Plano {sel?.name ?? selected}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatCurrency(sel?.priceBRL || 0)} / mês
                      </p>
                    </>
                  )
                })()}
              </div>
              <button
                onClick={closeModal}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/50 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={onCheckout} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">CPF ou CNPJ *</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpfCnpj}
                  required
                  onChange={(e) => setCpfCnpj(maskCpfCnpj(e.target.value))}
                  maxLength={18}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Forma de pagamento *</label>
                <select
                  value={billingType}
                  onChange={(e) => setBillingType(e.target.value as BillingType)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                >
                  {(Object.keys(BILLING_LABELS) as BillingType[]).map((b) => (
                    <option key={b} value={b}>
                      {BILLING_LABELS[b]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Celular <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="11999999999"
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 border border-border text-foreground rounded-lg font-semibold hover:bg-accent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    "Confirmar"
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground text-center pt-2">
                Você vai ser redirecionado pro pagamento. Sem fidelidade.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
