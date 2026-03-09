"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle, Loader, LogOut } from "lucide-react"

export default function IntegracaoPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [integration, setIntegration] = useState<{
    configured: boolean
    sellerID?: string
    expiresAt?: string
    isExpired?: boolean
  } | null>(null)

  // Verifica parâmetros de sucesso/erro do callback
  useEffect(() => {
    const error = searchParams.get("error")
    const success = searchParams.get("success")

    if (error) {
      setStatus("error")
      setMessage(`Erro: ${decodeURIComponent(error)}`)
    } else if (success) {
      setStatus("success")
      setMessage(decodeURIComponent(success))
      checkIntegration()
    }
  }, [searchParams])

  // Verificar status da integração
  const checkIntegration = async () => {
    try {
      const res = await fetch("/api/mercadolivre/integration")
      const data = await res.json()
      setIntegration(data)
    } catch (error) {
      console.error("Erro ao verificar integração:", error)
    }
  }

  useEffect(() => {
    checkIntegration()
  }, [])

  // Iniciar login com Mercado Livre
  const handleLoginML = async () => {
    setStatus("loading")
    try {
      const res = await fetch("/api/mercadolivre/auth")
      
      if (!res.ok) {
        const error = await res.json()
        setStatus("error")
        setMessage(
          error.details ||
          error.error ||
          "Erro ao conectar com Mercado Livre"
        )
        return
      }

      // Se OK, NextResponse.redirect vai redirecionar
      window.location.href = "/api/mercadolivre/auth"
    } catch (error) {
      setStatus("error")
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao conectar com servidor"
      )
    }
  }

  // Desconectar do Mercado Livre
  const handleDisconnect = async () => {
    if (window.confirm("Tem certeza que deseja desconectar do Mercado Livre?")) {
      try {
        // Chamar endpoint para deletar integração
        const res = await fetch("/api/mercadolivre/integration", {
          method: "DELETE",
        })

        if (res.ok) {
          setStatus("success")
          setMessage("Desconectado do Mercado Livre")
          setIntegration(null)
          setTimeout(() => checkIntegration(), 1000)
        }
      } catch (error) {
        setStatus("error")
        setMessage("Erro ao desconectar")
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-admin-900">Integrações</h1>
        <p className="text-admin-600 mt-2">Conecte sua loja com plataformas externas</p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg border p-4 flex items-start gap-3 ${
            status === "success"
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          {status === "success" ? (
            <CheckCircle className="text-green-600 mt-0.5" size={20} />
          ) : (
            <AlertCircle className="text-red-600 mt-0.5" size={20} />
          )}
          <div>
            <p
              className={
                status === "success"
                  ? "text-green-800 font-semibold"
                  : "text-red-800 font-semibold"
              }
            >
              {status === "success" ? "Sucesso" : "Erro"}
            </p>
            <p className={status === "success" ? "text-green-700" : "text-red-700"}>
              {message}
            </p>
          </div>
        </div>
      )}

      {/* Mercado Livre Card */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-admin-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center text-2xl">
              🇧🇷
            </div>
            <div>
              <h2 className="text-xl font-bold text-admin-900">Mercado Livre</h2>
              <p className="text-admin-600 text-sm">Sincronize seus produtos automaticamente</p>
            </div>
          </div>
        </div>

        {integration?.configured ? (
          <div className="space-y-4">
            {/* Status Conectado */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="text-green-600" size={20} />
                <span className="font-semibold text-green-900">Conectado</span>
              </div>
              <div className="space-y-2 text-sm text-green-800">
                <p>
                  <span className="font-semibold">ID do Vendedor:</span> {integration.sellerID}
                </p>
                {integration.expiresAt && (
                  <p>
                    <span className="font-semibold">Expira em:</span>{" "}
                    {new Date(integration.expiresAt).toLocaleDateString("pt-BR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
                {integration.isExpired && (
                  <p className="text-orange-600 font-semibold">
                    ⚠️ Token expirado - reconecte sua conta
                  </p>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleDisconnect}
                className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 font-semibold px-4 py-2 rounded-lg transition flex items-center justify-center gap-2"
              >
                <LogOut size={18} />
                Desconectar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-admin-600">
              Conecte sua conta do Mercado Livre para sincronizar seus produtos automaticamente.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Como funciona:</span>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Você será redirecionado para o Mercado Livre</li>
                  <li>Autorize o acesso à sua conta</li>
                  <li>Seus produtos serão sincronizados automaticamente</li>
                </ul>
              </p>
            </div>

            <button
              onClick={handleLoginML}
              disabled={status === "loading"}
              className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-300 text-black font-bold px-4 py-3 rounded-lg transition flex items-center justify-center gap-2"
            >
              {status === "loading" && <Loader className="animate-spin" size={18} />}
              {status === "loading"
                ? "Redirecionando..."
                : "Conectar ao Mercado Livre"}
            </button>
          </div>
        )}
      </div>

      {/* Coming Soon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-admin-200 opacity-50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-2xl">
                🛍️
              </div>
              <div>
                <h2 className="text-xl font-bold text-admin-900">Shopee</h2>
                <p className="text-admin-600 text-sm">Em breve</p>
              </div>
            </div>
          </div>
          <button
            disabled
            className="w-full bg-gray-300 text-gray-600 font-semibold px-4 py-2 rounded-lg cursor-not-allowed"
          >
            Indisponível no momento
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-admin-200 opacity-50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">
                🏪
              </div>
              <div>
                <h2 className="text-xl font-bold text-admin-900">OLX</h2>
                <p className="text-admin-600 text-sm">Em breve</p>
              </div>
            </div>
          </div>
          <button
            disabled
            className="w-full bg-gray-300 text-gray-600 font-semibold px-4 py-2 rounded-lg cursor-not-allowed"
          >
            Indisponível no momento
          </button>
        </div>
      </div>
    </div>
  )
}
