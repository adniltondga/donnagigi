"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Loader2, Mail } from "lucide-react"

function OTPInputs({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(6, " ").split("").slice(0, 6)

  const setChar = (i: number, char: string) => {
    const arr = value.padEnd(6, " ").split("")
    arr[i] = char
    onChange(arr.join("").trim())
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={(e) => {
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
      if (pasted.length > 0) {
        e.preventDefault()
        onChange(pasted)
        const focusIdx = Math.min(pasted.length, 5)
        refs.current[focusIdx]?.focus()
      }
    }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digits[i] === " " ? "" : digits[i]}
          onChange={(e) => {
            const c = e.target.value.replace(/\D/g, "").slice(-1)
            setChar(i, c || " ")
            if (c && i < 5) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i].trim() && i > 0) {
              refs.current[i - 1]?.focus()
            }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus()
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus()
          }}
          className="w-12 h-14 text-center text-2xl font-mono font-bold border-2 border-gray-300 rounded-lg focus:border-primary-600 focus:ring-2 focus:ring-primary-200 outline-none transition"
        />
      ))}
    </div>
  )
}

function VerifyEmailInner() {
  const router = useRouter()
  const params = useSearchParams()
  const email = params.get("email") || ""

  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [cooldown, setCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const [info, setInfo] = useState("")

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const setTokenAndGo = async (token: string) => {
    const r = await fetch("/api/auth/set-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    if (!r.ok) {
      setError("Erro ao salvar autenticação")
      return
    }
    setTimeout(() => router.push("/admin/dashboard"), 100)
  }

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Código inválido")
        setCode("")
        return
      }
      if (data.token) await setTokenAndGo(data.token)
    } catch {
      setError("Erro ao conectar")
    } finally {
      setLoading(false)
    }
  }

  const onResend = async () => {
    if (cooldown > 0) return
    setResending(true)
    setInfo("")
    setError("")
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setInfo("Código reenviado. Veja seu email.")
        setCooldown(60)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Erro ao reenviar")
        if (data.error?.includes("Aguarde")) {
          const sec = parseInt(data.error.match(/(\d+)s/)?.[1] || "60", 10)
          setCooldown(sec)
        }
      }
    } catch {
      setError("Erro ao conectar")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 via-white to-fuchsia-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="font-bold text-white">aL</span>
            </div>
            <span className="text-2xl font-bold">
              ag<span className="text-primary-600">Livre</span>
            </span>
          </div>
          <div className="w-12 h-12 mx-auto bg-primary-100 rounded-full flex items-center justify-center mb-3">
            <Mail className="w-6 h-6 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Verifique seu email</h1>
          <p className="text-sm text-gray-600">
            Enviamos um código de 6 dígitos para:
          </p>
          <p className="text-sm font-semibold text-gray-900">{email || "—"}</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}
        {info && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {info}
          </div>
        )}

        <form onSubmit={onVerify} className="space-y-5">
          <OTPInputs value={code} onChange={setCode} disabled={loading} />

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                Verificar email
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={onResend}
            disabled={cooldown > 0 || resending}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {cooldown > 0
              ? `Reenviar em ${cooldown}s`
              : resending
              ? "Reenviando..."
              : "Não recebi o código — reenviar"}
          </button>
        </div>

        <div className="text-center pt-2 border-t border-gray-100">
          <Link href="/admin/login" className="text-sm text-gray-500 hover:text-gray-700">
            ← Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  )
}
