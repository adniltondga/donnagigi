"use client"

import { useState } from "react"
import { CreditCard, Loader2, X } from "lucide-react"

type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD"

const BILLING_LABEL: Record<BillingType, string> = {
  PIX: "PIX (manual a cada mês)",
  BOLETO: "Boleto (manual a cada mês)",
  CREDIT_CARD: "Cartão de crédito (cobrança automática)",
}

interface Props {
  hasCustomer: boolean
  onClose: () => void
  onSuccess: () => void
}

export function UpdatePaymentModal({ hasCustomer, onClose, onSuccess }: Props) {
  const [billingType, setBillingType] = useState<BillingType>("CREDIT_CARD")
  const [cpfCnpj, setCpfCnpj] = useState("")
  const [mobilePhone, setMobilePhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const body: Record<string, string> = { billingType }
      if (!hasCustomer) {
        body.cpfCnpj = cpfCnpj
        if (mobilePhone) body.mobilePhone = mobilePhone
      }
      const res = await fetch("/api/billing/update-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao atualizar pagamento")
        return
      }
      onSuccess()
    } catch {
      setError("Erro de conexão")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 shrink-0 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center">
            <CreditCard size={20} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-gray-900">Atualizar método de pagamento</h2>
            <p className="text-sm text-gray-600 mt-1">
              Escolha como cobrar a próxima fatura. Sua assinatura continua
              ativa — só muda o método.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Método de pagamento
            </label>
            <div className="space-y-2">
              {(Object.keys(BILLING_LABEL) as BillingType[]).map((t) => (
                <label
                  key={t}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${
                    billingType === t
                      ? "border-primary-600 bg-primary-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="billingType"
                    value={t}
                    checked={billingType === t}
                    onChange={() => setBillingType(t)}
                    className="accent-primary-600"
                  />
                  <span>{BILLING_LABEL[t]}</span>
                </label>
              ))}
            </div>
          </div>

          {!hasCustomer && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  CPF ou CNPJ
                </label>
                <input
                  type="text"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-600 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Celular (opcional)
                </label>
                <input
                  type="tel"
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                  placeholder="(11) 91234-5678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-600 text-sm"
                />
              </div>
            </>
          )}

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Atualizar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
