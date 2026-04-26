"use client"

import { useState } from "react"
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react"

interface Props {
  /** De qual CTA / página o email veio (analytics interno). */
  source?: string
  /** Variante visual: "light" pra fundo branco, "onPrimary" pra fundo gradient roxo. */
  variant?: "light" | "onPrimary"
  /** Texto do botão. */
  buttonLabel?: string
  className?: string
}

/**
 * Formulário de captura de email pra lista de espera. Usado no marketing
 * enquanto o cadastro está fechado — enviamos um email quando abrir.
 */
export function WaitlistForm({
  source = "home",
  variant = "light",
  buttonLabel = "Avise-me quando abrir",
  className = "",
}: Props) {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "saving" | "ok" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string>("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setState("saving")
    setErrorMsg("")
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErrorMsg(d.error || "Erro ao salvar")
        setState("error")
        return
      }
      setState("ok")
    } catch {
      setErrorMsg("Erro de conexão")
      setState("error")
    }
  }

  if (state === "ok") {
    const okBox =
      variant === "onPrimary"
        ? "bg-white/10 border border-white/30 text-white"
        : "bg-emerald-50 border border-emerald-200 text-emerald-900"
    return (
      <div className={`rounded-lg p-4 flex items-start gap-3 ${okBox} ${className}`}>
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm">Tudo certo, você está na lista!</p>
          <p className={`text-xs mt-0.5 ${variant === "onPrimary" ? "text-white/80" : "text-emerald-800"}`}>
            Vamos te avisar por email assim que liberarmos os cadastros.
          </p>
        </div>
      </div>
    )
  }

  const inputCls =
    variant === "onPrimary"
      ? "bg-white/10 border-white/30 text-white placeholder:text-white/60 focus:border-white"
      : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-primary-600"

  const btnCls =
    variant === "onPrimary"
      ? "bg-white text-primary-700 hover:bg-primary-50"
      : "bg-primary-600 text-white hover:bg-primary-700"

  return (
    <form onSubmit={submit} className={`flex flex-col sm:flex-row gap-2 ${className}`}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        disabled={state === "saving"}
        className={`flex-1 border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-300 transition ${inputCls}`}
      />
      <button
        type="submit"
        disabled={state === "saving" || !email.trim()}
        className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${btnCls}`}
      >
        {state === "saving" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            {buttonLabel}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
      {state === "error" && (
        <p className={`text-xs sm:absolute sm:mt-12 ${variant === "onPrimary" ? "text-rose-200" : "text-rose-600"}`}>
          {errorMsg}
        </p>
      )}
    </form>
  )
}
