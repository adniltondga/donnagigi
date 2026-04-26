"use client"

import { useState } from "react"
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react"

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const close = () => {
    if (loading) return
    setOpen(false)
    setPassword("")
    setConfirmation("")
    setReason("")
    setError("")
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation, reason: reason || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao excluir conta")
        return
      }
      // Sucesso — sessão já foi limpa pelo backend. Redireciona pra home.
      window.location.href = "/"
    } catch {
      setError("Erro de conexão")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="font-semibold text-red-700 dark:text-red-400 mb-1">
          Excluir minha conta
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Cancela sua assinatura, revoga integrações e marca seus dados pra
          exclusão permanente em 30 dias. Você pode restaurar dentro desse
          prazo.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold transition"
        >
          <Trash2 size={14} />
          Excluir conta
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={close}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 shrink-0 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-gray-900">Tem certeza?</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Sua conta será excluída e os dados apagados em <strong>30 dias</strong>.
                  Até lá você pode restaurar fazendo login normalmente.
                </p>
              </div>
              <button
                onClick={close}
                disabled={loading}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Sua senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Digite <strong>DELETAR</strong> pra confirmar
                </label>
                <input
                  type="text"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Por que está saindo? (opcional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Sua resposta nos ajuda a melhorar..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm resize-none"
                />
              </div>
              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                  {error}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={loading}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || confirmation !== "DELETAR" || !password}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Excluir conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
