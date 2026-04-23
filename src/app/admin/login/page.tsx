"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Loader } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState("")
  const [name, setName] = useState("")
  const [companyName, setCompanyName] = useState("")

  useEffect(() => {
    if (params.get("register") === "1") setIsRegister(true)
  }, [params])

  const setTokenAndRedirect = async (token: string) => {
    const tokenRes = await fetch("/api/auth/set-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    if (!tokenRes.ok) {
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
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao fazer login")
        return
      }
      if (data.token) await setTokenAndRedirect(data.token)
    } catch (err) {
      console.error(err)
      setError("Erro ao conectar ao servidor")
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, name, companyName }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao criar conta")
        return
      }
      // Auto-login após cadastro
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const loginData = await loginRes.json()
      if (loginRes.ok && loginData.token) {
        await setTokenAndRedirect(loginData.token)
      } else {
        setIsRegister(false)
        setPassword("")
      }
    } catch (err) {
      console.error(err)
      setError("Erro ao conectar ao servidor")
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = isRegister ? handleRegister : handleLogin
  const toggleMode = () => {
    setIsRegister((v) => !v)
    setError("")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-fuchsia-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="font-bold text-white">aL</span>
              </div>
              <span className="text-2xl font-bold tracking-tight">
                ag<span className="text-primary-600">Livre</span>
              </span>
            </div>
            <p className="text-admin-600">
              {isRegister ? "Crie sua conta" : "Bem-vindo de volta"}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-red-800">Erro</p>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-sm font-medium text-admin-700 mb-2">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    required
                    className="w-full px-4 py-3 border border-admin-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-admin-700 mb-2">
                    Nome do negócio
                    <span className="text-admin-400 font-normal ml-1">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Minha Loja de Capinhas"
                    className="w-full px-4 py-3 border border-admin-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-admin-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Escolha um username"
                    required
                    className="w-full px-4 py-3 border border-admin-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-admin-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-4 py-3 border border-admin-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-admin-700 mb-2">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={isRegister ? 6 : undefined}
                className="w-full px-4 py-3 border border-admin-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition"
              />
              {isRegister && (
                <p className="text-xs text-admin-500 mt-1">Mínimo 6 caracteres</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading && <Loader size={18} className="animate-spin" />}
              {loading ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
            </button>
          </form>

          <div className="text-center text-sm text-admin-600">
            {isRegister ? (
              <>
                Já tem uma conta?{" "}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-primary-600 hover:text-primary-700 font-semibold"
                >
                  Entrar
                </button>
              </>
            ) : (
              <>
                Não tem conta?{" "}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-primary-600 hover:text-primary-700 font-semibold"
                >
                  Criar conta grátis
                </button>
              </>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-admin-600 hover:text-primary-600 font-medium transition text-sm"
          >
            ← Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  )
}
