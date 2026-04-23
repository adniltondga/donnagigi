"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  User,
  Building2,
} from "lucide-react"

const SAVED_EMAIL_KEY = "aglivre_saved_email"

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Login form
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)

  // Register form
  const [name, setName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [username, setUsername] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirm, setRegConfirm] = useState("")

  useEffect(() => {
    if (params.get("register") === "1") setIsRegisterMode(true)
  }, [params])

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem(SAVED_EMAIL_KEY)
    if (saved) {
      setLoginEmail(saved)
      setRememberMe(true)
    }
  }, [])

  const switchMode = () => {
    setIsRegisterMode((v) => !v)
    setError("")
    setShowPassword(false)
  }

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao fazer login")
        return
      }
      if (rememberMe) {
        localStorage.setItem(SAVED_EMAIL_KEY, loginEmail)
      } else {
        localStorage.removeItem(SAVED_EMAIL_KEY)
      }
      if (data.token) await setTokenAndGo(data.token)
    } catch {
      setError("Erro ao conectar ao servidor")
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (regPassword !== regConfirm) {
      setError("As senhas não conferem")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail,
          username,
          password: regPassword,
          name,
          companyName,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao criar conta")
        return
      }
      // Auto-login (Fase 2 de email verification troca isso por redirect pra /verify-email)
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail, password: regPassword }),
      })
      const loginData = await loginRes.json()
      if (loginRes.ok && loginData.token) {
        await setTokenAndGo(loginData.token)
      } else {
        setIsRegisterMode(false)
        setRegPassword("")
        setRegConfirm("")
      }
    } catch {
      setError("Erro ao conectar ao servidor")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Coluna esquerda — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="bg-primary-600 p-2 rounded-lg">
              <span className="text-white font-bold text-lg">aL</span>
            </div>
            <span className="text-xl font-bold text-gray-900">
              ag<span className="text-primary-600">Livre</span>
            </span>
          </Link>

          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isRegisterMode ? "Criar conta" : "Bem-vindo de volta"}
            </h1>
            <p className="text-gray-600">
              {isRegisterMode
                ? "Cadastre sua conta e conecte seu Mercado Livre"
                : "Entre para acessar o painel do seu negócio"}
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => isRegisterMode && switchMode()}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all ${
                !isRegisterMode
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => !isRegisterMode && switchMode()}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all ${
                isRegisterMode
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Criar conta
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {!isRegisterMode ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <Field
                id="login-email"
                label="Email"
                icon={<Mail />}
                type="email"
                placeholder="seu@email.com"
                value={loginEmail}
                onChange={setLoginEmail}
                required
              />

              <PasswordField
                id="login-password"
                label="Senha"
                value={loginPassword}
                onChange={setLoginPassword}
                show={showPassword}
                toggleShow={() => setShowPassword((v) => !v)}
                placeholder="••••••••"
                required
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                  />
                  <span className="text-sm text-gray-600">Lembrar de mim</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Esqueceu a senha?
                </Link>
              </div>

              <SubmitButton loading={loading} label="Entrar" loadingLabel="Entrando..." />
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
              <Field
                id="reg-name"
                label="Seu nome"
                icon={<User />}
                placeholder="João Silva"
                value={name}
                onChange={setName}
                required
              />

              <Field
                id="reg-company"
                label="Nome do negócio"
                hint="(opcional)"
                icon={<Building2 />}
                placeholder="Ex: Capinhas da Maria"
                value={companyName}
                onChange={setCompanyName}
              />

              <Field
                id="reg-username"
                label="Username"
                icon={<User />}
                placeholder="joaosilva"
                value={username}
                onChange={setUsername}
                required
              />

              <Field
                id="reg-email"
                label="Email"
                icon={<Mail />}
                type="email"
                placeholder="seu@email.com"
                value={regEmail}
                onChange={setRegEmail}
                required
              />

              <PasswordField
                id="reg-password"
                label="Senha"
                value={regPassword}
                onChange={setRegPassword}
                show={showPassword}
                toggleShow={() => setShowPassword((v) => !v)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />

              <Field
                id="reg-confirm"
                label="Confirmar senha"
                icon={<Lock />}
                type={showPassword ? "text" : "password"}
                placeholder="Repita a senha"
                value={regConfirm}
                onChange={setRegConfirm}
                required
              />

              <SubmitButton
                loading={loading}
                label="Criar conta"
                loadingLabel="Criando conta..."
              />
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
              ← Voltar ao site
            </Link>
          </div>
        </div>
      </div>

      {/* Coluna direita — marketing (só desktop) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-600 via-primary-700 to-fuchsia-700 items-center justify-center p-12">
        <div className="max-w-lg text-white">
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            Controle seu ML de qualquer lugar
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Acompanhe suas vendas, lucros reais e quando o dinheiro vai liberar — tudo em tempo real.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold">
                DG
              </div>
              <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center text-sm font-semibold">
                ML
              </div>
              <div className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center text-sm font-semibold">
                MP
              </div>
            </div>
            <p className="text-primary-100">Simples. Rápido. Transparente.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  hint,
  icon,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
  minLength,
}: {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  type?: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  minLength?: number
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {hint && <span className="text-gray-400 font-normal ml-1">{hint}</span>}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400">
          {icon}
        </div>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          required={required}
          minLength={minLength}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none transition-all text-gray-900"
        />
      </div>
    </div>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  toggleShow,
  placeholder,
  required,
  minLength,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  toggleShow: () => void
  placeholder?: string
  required?: boolean
  minLength?: number
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          required={required}
          minLength={minLength}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none transition-all text-gray-900"
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </div>
  )
}

function SubmitButton({
  loading,
  label,
  loadingLabel,
}: {
  loading: boolean
  label: string
  loadingLabel: string
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="w-5 h-5" />
        </>
      )}
    </button>
  )
}
