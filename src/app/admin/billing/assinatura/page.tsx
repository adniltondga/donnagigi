"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react"
import { formatCurrency } from "@/lib/calculations"

type Status = "TRIAL" | "ACTIVE" | "PENDING" | "OVERDUE" | "CANCELED" | "EXPIRED"
type Plan = "FREE" | "PRO"
type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD"

const BILLING_LABELS: Record<BillingType, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
}

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

interface SubResponse {
  subscription: {
    id: string
    plan: Plan
    status: Status
    billingType: BillingType | null
    value: number | null
    currentPeriodEnd: string | null
    trialEndsAt: string | null
    canceledAt: string | null
  }
  plan: { name: string; priceBRL: number; features: string[] }
  trialDaysLeft: number | null
  canUse: boolean
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR")
}

export default function AssinaturaPage() {
  const [data, setData] = useState<SubResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [canceling, setCanceling] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

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
    if (!confirm("Tem certeza que deseja cancelar? Você perderá acesso aos recursos do plano Pro.")) return
    setCanceling(true)
    setMessage(null)
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" })
      if (res.ok) {
        setMessage({ type: "success", text: "Assinatura cancelada." })
        load()
      } else {
        const d = await res.json().catch(() => ({}))
        setMessage({ type: "error", text: d.error || "Erro ao cancelar" })
      }
    } catch {
      setMessage({ type: "error", text: "Erro ao conectar" })
    } finally {
      setCanceling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Carregando...
      </div>
    )
  }

  if (!data) {
    return <div className="p-8 text-gray-500">Nenhuma assinatura encontrada.</div>
  }

  const { subscription, plan, trialDaysLeft } = data
  const isPaid = subscription.plan !== "FREE"
  const canCancel =
    isPaid && (subscription.status === "ACTIVE" || subscription.status === "PENDING")

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Assinatura</h1>
        <p className="text-gray-600 mt-1">Seu plano e informações de pagamento.</p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Card principal */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-sm text-gray-500">Plano atual</div>
            <div className="text-3xl font-bold mt-1 text-gray-900">{plan.name}</div>
            {subscription.value != null && (
              <div className="text-sm text-gray-600 mt-1">
                {formatCurrency(Number(subscription.value))} / mês
              </div>
            )}
            {subscription.plan === "FREE" && plan.priceBRL === 0 && (
              <div className="text-sm text-gray-600 mt-1">Grátis</div>
            )}
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[subscription.status]}`}
          >
            {STATUS_LABELS[subscription.status]}
          </span>
        </div>

        {/* Alertas por status */}
        {subscription.status === "TRIAL" && trialDaysLeft !== null && (
          <div className="flex items-start gap-3 bg-primary-50 border border-primary-200 rounded-lg p-4">
            <Sparkles className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
            <div className="text-sm text-primary-900">
              <p className="font-semibold">Você está no trial gratuito!</p>
              <p className="mt-0.5">
                {trialDaysLeft === 0
                  ? "Seu trial termina hoje."
                  : `Restam ${trialDaysLeft} dia${trialDaysLeft === 1 ? "" : "s"} de trial.`}{" "}
                Faça upgrade pro Pro pra continuar sem interrupção.
              </p>
            </div>
          </div>
        )}

        {subscription.status === "OVERDUE" && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              Há uma cobrança em atraso. Pague a fatura em aberto pra manter o acesso.
            </div>
          </div>
        )}

        {subscription.status === "PENDING" && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              Aguardando confirmação do primeiro pagamento. Veja as faturas pra pagar agora.
            </div>
          </div>
        )}

        {subscription.status === "EXPIRED" && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              Seu trial/assinatura expirou. Faça upgrade pra continuar usando o agLivre.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <div>
            <div className="text-xs text-gray-500">Forma de pagamento</div>
            <div className="text-sm font-medium mt-1 text-gray-900">
              {subscription.billingType ? BILLING_LABELS[subscription.billingType] : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">
              {subscription.status === "TRIAL" ? "Trial até" : "Próxima cobrança"}
            </div>
            <div className="text-sm font-medium mt-1 text-gray-900">
              {formatDate(
                subscription.status === "TRIAL"
                  ? subscription.trialEndsAt
                  : subscription.currentPeriodEnd
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/billing/planos"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2.5 rounded-lg transition"
        >
          <CreditCard className="w-4 h-4" />
          {isPaid ? "Trocar de plano" : "Fazer upgrade"}
        </Link>

        <Link
          href="/admin/billing/faturas"
          className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-50 transition"
        >
          <FileText className="w-4 h-4" />
          Ver faturas
        </Link>

        {canCancel && (
          <button
            onClick={onCancel}
            disabled={canceling}
            className="inline-flex items-center gap-2 border border-red-300 text-red-700 font-semibold px-4 py-2.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
          >
            {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Cancelar assinatura
          </button>
        )}
      </div>

      {/* CTA upgrade se FREE/TRIAL */}
      {(subscription.plan === "FREE" || subscription.status === "TRIAL") && (
        <div className="bg-gradient-to-br from-primary-50 to-fuchsia-50 border border-primary-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-primary-900">
                Desbloqueie todo o potencial do agLivre
              </h3>
              <p className="text-sm text-primary-800 mt-1">
                Com o Plano Pro você tem vendas ilimitadas, relatório V2, previsão de recebimentos,
                gestão de custos por anúncio e sincronização com o Mercado Pago.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
