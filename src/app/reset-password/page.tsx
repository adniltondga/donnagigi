"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Eye, EyeOff, Loader2, Lock } from "lucide-react"

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
    <div
      className="flex gap-2 justify-center"
      onPaste={(e) => {
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
        if (pasted.length > 0) {
          e.preventDefault()
          onChange(pasted)
          const focusIdx = Math.min(pasted.length, 5)
          refs.current[focusIdx]?.focus()
        }
      }}
    >
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

function ResetInner() {
  const router = useRouter()
  const params = useSearchParams()
  const email = params.get("email") || ""

  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => router.push("/admin/login"), 1500)
      return () => clearTimeout(t)
    }
  }, [success, router])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (code.length !== 6) {
      setError("Digite o código de 6 dígitos")
      return
    }
    if (password !== confirm) {
      setError("As senhas não conferem")
      return
    }
    if (password.length < 6) {
      setError("Senha precisa ter ao menos 6 caracteres")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword: password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao redefinir")
        return
      }
      setSuccess(true)
    } catch {
      setError("Erro ao conectar")
    } finally {
      setLoading(false)
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
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Redefinir senha</h1>
          <p className="text-sm text-gray-600">
            Código enviado para <span className="font-semibold text-gray-900">{email || "—"}</span>
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            Senha redefinida! Redirecionando para o login…
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
              Código de 6 dígitos
            </label>
            <OTPInputs value={code} onChange={setCode} disabled={loading || success} />
          </div>

          <div>
            <label htmlFor="pass" className="block text-sm font-medium text-gray-700 mb-2">
              Nova senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="pass"
                type={show ? "text" : "password"}
                required
                minLength={6}
                disabled={loading || success}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none transition text-gray-900"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="conf" className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar nova senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="conf"
                type={show ? "text" : "password"}
                required
                minLength={6}
                disabled={loading || success}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a senha"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none transition text-gray-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success || code.length !== 6}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                Redefinir senha
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-gray-100">
          <Link href="/admin/login" className="text-sm text-gray-500 hover:text-gray-700">
            ← Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  )
}
