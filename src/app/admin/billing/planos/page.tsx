"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, Loader2, X, Sparkles } from "lucide-react"
import { formatCurrency } from "@/lib/calculations"
import { maskCpfCnpj, unmaskCpfCnpj } from "@/lib/mask"

interface PlanInfo {
  id: "FREE" | "PRO"
  name: string
  tagline: string
  priceBRL: number
  features: string[]
  popular?: boolean
}

type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD"

const BILLING_LABELS: Record<BillingType, string> = {
  PIX: "PIX",
  BOLETO: "Boleto bancário",
  CREDIT_CARD: "Cartão de crédito",
}

export default function PlanosPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<PlanInfo[] | null>(null)
  const [currentPlan, setCurrentPlan] = useState<"FREE" | "PRO" | null>(null)
  const [selected, setSelected] = useState<"PRO" | null>(null)
  const [loading, setLoading] = useState(true)

  // Form state do modal
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
        setError(data.error || "Erro ao processar")
        return
      }
      const first = data.payments?.[0]
      if (first?.invoiceUrl) {
        window.open(first.invoiceUrl, "_blank")
      }
      router.push("/admin/billing/assinatura")
    } catch {
      setError("Erro ao conectar")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Carregando planos...
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Planos</h1>
        <p className="text-gray-600 mt-1">Escolha o plano ideal pro seu negócio no Mercado Livre.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(plans || []).map((p) => {
          const isCurrent = currentPlan === p.id
          const isFree = p.id === "FREE"
          return (
            <div
              key={p.id}
              className={`relative rounded-2xl p-6 flex flex-col border ${
                p.popular
                  ? "bg-gradient-to-br from-primary-600 to-fuchsia-700 text-white border-primary-600 shadow-xl"
                  : "bg-white border-gray-200"
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Mais popular
                </div>
              )}

              <div className="mb-4">
                <h3 className={`text-xl font-bold ${p.popular ? "text-white" : "text-gray-900"}`}>
                  {p.name}
                </h3>
                <p className={`text-sm mt-1 ${p.popular ? "text-primary-100" : "text-gray-500"}`}>
                  {p.tagline}
                </p>
              </div>

              <div className="mb-6">
                <span className={`text-4xl font-bold ${p.popular ? "text-white" : "text-gray-900"}`}>
                  {p.priceBRL === 0 ? "Grátis" : formatCurrency(p.priceBRL)}
                </span>
                {p.priceBRL > 0 && (
                  <span className={`text-sm ml-1 ${p.popular ? "text-primary-100" : "text-gray-500"}`}>
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
                    <span className={p.popular ? "text-primary-50" : "text-gray-700"}>{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button
                  disabled
                  className={`w-full py-2.5 rounded-lg font-semibold ${
                    p.popular
                      ? "bg-white/20 text-white cursor-not-allowed"
                      : "bg-gray-100 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Plano atual
                </button>
              ) : isFree ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-lg font-semibold bg-gray-100 text-gray-500 cursor-not-allowed"
                >
                  Plano grátis
                </button>
              ) : (
                <button
                  onClick={() => setSelected("PRO")}
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

      {/* Modal de checkout */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Assinar Plano Pro</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {formatCurrency(plans?.find((p) => p.id === "PRO")?.priceBRL || 0)} / mês
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={onCheckout} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF ou CNPJ *</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpfCnpj}
                  required
                  onChange={(e) => setCpfCnpj(maskCpfCnpj(e.target.value))}
                  maxLength={18}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pagamento *</label>
                <select
                  value={billingType}
                  onChange={(e) => setBillingType(e.target.value as BillingType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                >
                  {(Object.keys(BILLING_LABELS) as BillingType[]).map((b) => (
                    <option key={b} value={b}>
                      {BILLING_LABELS[b]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Celular <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="11999999999"
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50"
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
              <p className="text-xs text-gray-500 text-center pt-2">
                Você vai ser redirecionado pro pagamento. Sem fidelidade.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
