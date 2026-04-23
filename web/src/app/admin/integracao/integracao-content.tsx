"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle, Loader, LogOut, RefreshCw } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"

export default function IntegracaoContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "syncing">("idle")
  const [message, setMessage] = useState("")
  const [syncResult, setSyncResult] = useState<any>(null)
  const [isLoadingIntegration, setIsLoadingIntegration] = useState(true)
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
      setIntegration({ configured: false })
    } finally {
      setIsLoadingIntegration(false)
    }
  }

  useEffect(() => {
    checkIntegration()
  }, [])

  // Iniciar login com Mercado Livre
  const handleLoginML = () => {
    setStatus("loading")
    // Redirecionar para o endpoint OAuth (PKCE flow)
    // O navegador vai seguir o redirect para Mercado Livre
    window.location.href = "/api/ml/oauth/login"
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

  // Sincronizar produtos do Mercado Livre
  const handleSyncProducts = async () => {
    setStatus("syncing")
    setMessage("")
    setSyncResult(null)

    try {
      const res = await fetch("/api/ml/sync", {
        method: "GET",
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus("error")
        setMessage(data.error || "Erro ao sincronizar produtos")
        return
      }

      setSyncResult(data)
      setStatus("success")
      setMessage(data.message)

      // Limpar mensagem após 10 segundos
      setTimeout(() => {
        setStatus("idle")
        setMessage("")
      }, 10000)
    } catch (error) {
      setStatus("error")
      setMessage(`Erro ao conectar: ${error instanceof Error ? error.message : "Erro desconhecido"}`)
    }
  }

  // Sincronizar pedidos do Mercado Livre para financeiro
  const handleSyncOrders = async () => {
    setStatus("syncing")
    setMessage("")
    setSyncResult(null)

    try {
      const res = await fetch("/api/ml/sync-orders", {
        method: "GET",
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus("error")
        setMessage(data.error || "Erro ao sincronizar vendas")
        return
      }

      setSyncResult(data)
      setStatus("success")
      setMessage(data.message)

      // Limpar mensagem após 10 segundos
      setTimeout(() => {
        setStatus("idle")
        setMessage("")
      }, 10000)
    } catch (error) {
      setStatus("error")
      setMessage(`Erro ao conectar: ${error instanceof Error ? error.message : "Erro desconhecido"}`)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Integrações" description="Conecte sua loja com plataformas externas" />

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
      <Card className="p-6">
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

        {isLoadingIntegration ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="animate-spin text-primary-500" size={32} />
          </div>
        ) : integration?.configured ? (
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
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  onClick={handleSyncProducts}
                  disabled={status === "syncing"}
                  className="flex-1 bg-green-100 hover:bg-green-200 disabled:bg-green-300 text-green-700 hover:text-green-800 disabled:text-green-600 font-semibold px-4 py-2 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {status === "syncing" ? (
                    <>
                      <Loader className="animate-spin" size={18} />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={18} />
                      Sincronizar Produtos (até 25)
                    </>
                  )}
                </button>

                <button
                  onClick={handleDisconnect}
                  className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 font-semibold px-4 py-2 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <LogOut size={18} />
                  Desconectar
                </button>
              </div>

              <button
                onClick={handleSyncOrders}
                disabled={status === "syncing"}
                className="w-full bg-blue-100 hover:bg-blue-200 disabled:bg-blue-300 text-blue-700 hover:text-blue-800 disabled:text-blue-600 font-semibold px-4 py-2 rounded-lg transition flex items-center justify-center gap-2"
              >
                {status === "syncing" ? (
                  <>
                    <Loader className="animate-spin" size={18} />
                    Sincronizando Vendas...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    Sincronizar Vendas para Financeiro
                  </>
                )}
              </button>
            </div>

            {/* Sync Result */}
            {syncResult && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-900">📊 Resultado da Sincronização:</p>
                
                {syncResult.stats && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white p-2 rounded text-center">
                      <p className="text-xs text-gray-600">Total</p>
                      <p className="text-lg font-bold text-blue-600">{syncResult.stats.total}</p>
                    </div>
                    <div className="bg-white p-2 rounded text-center">
                      <p className="text-xs text-gray-600">Sincronizados</p>
                      <p className="text-lg font-bold text-green-600">{syncResult.stats.synced}</p>
                    </div>
                    <div className="bg-white p-2 rounded text-center">
                      <p className="text-xs text-gray-600">Erros</p>
                      <p className="text-lg font-bold text-red-600">{syncResult.stats.failed}</p>
                    </div>
                  </div>
                )}

                {syncResult.data && syncResult.data.length > 0 && (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    <p className="text-xs font-semibold text-blue-900">✅ Produtos Sincronizados:</p>
                    {syncResult.data.slice(0, 10).map((product: any) => (
                      <div key={product.id} className="bg-white p-2 rounded text-xs">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-900">{product.name}</span>
                          <span className="text-green-600">R$ {product.price.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                    {syncResult.data.length > 10 && (
                      <p className="text-xs text-gray-600 text-center">
                        ... e {syncResult.data.length - 10} mais produtos
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-admin-600 mb-4">
              Autentique com sua conta do Mercado Livre para sincronizar seus produtos:
            </p>

            {/* Método 2: OAuth */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-green-900">
                🔐 Login OAuth
              </p>
              
              <button
                onClick={handleLoginML}
                disabled={status === "loading"}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white font-bold px-4 py-2 rounded-lg transition flex items-center justify-center gap-2"
              >
                {status === "loading" && <Loader className="animate-spin" size={18} />}
                {status === "loading" ? "Redirecionando..." : "Conectar via OAuth"}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Coming Soon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 opacity-50">
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
        </Card>

        <Card className="p-6 opacity-50">
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
        </Card>
      </div>
    </div>
  )
}
