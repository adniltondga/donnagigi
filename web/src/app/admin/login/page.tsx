"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Loader } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState("")
  const [name, setName] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erro ao fazer login")
        return
      }

      // Salvar token em localStorage para verificação no layout
      if (data.token) {
        localStorage.setItem("adminToken", data.token)
      }
      // Redirecionar para dashboard
      router.push("/admin/dashboard")
    } catch (err) {
      setError("Erro ao conectar ao servidor")
      console.error(err)
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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, username, password, name })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erro ao criar conta")
        return
      }

      // Fazer login automático após registro
      setIsRegister(false)
      setEmail("")
      setPassword("")
      setUsername("")
      setName("")
    } catch (err) {
      setError("Erro ao conectar ao servidor")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = isRegister ? handleRegister : handleLogin

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-primary-600">Donna Gigi</h1>
            <p className="text-admin-600 mt-2">
              {isRegister ? "Crie sua conta" : "Bem-vindo de volta"}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-red-800">Erro</p>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-sm font-medium text-admin-700 mb-2">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
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
                    placeholder="Seu username"
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
                className="w-full px-4 py-3 border border-admin-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading && <Loader size={18} className="animate-spin" />}
              {loading
                ? "Aguarde..."
                : isRegister
                ? "Criar Conta"
                : "Entrar"}
            </button>
          </form>



          {/* Demo Credentials */}
          {!isRegister && (
            <div className="border-t border-admin-200 pt-6">
              <p className="text-sm text-admin-600 mb-3">
                <span className="font-semibold">Demo:</span> Registre-se para testar
              </p>
              <div className="space-y-2 text-xs text-admin-500 bg-admin-50 p-3 rounded">
                <p>• Digite um email válido</p>
                <p>• Crie um username único</p>
                <p>• Escolha uma senha forte</p>
              </div>
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-admin-600 hover:text-primary-600 font-medium transition"
          >
            ← Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  )
}
