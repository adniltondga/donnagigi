"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"

export function ExportDataButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const onDownload = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/account/export")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Erro ao gerar export")
        return
      }
      const blob = await res.blob()
      // Pega filename do header Content-Disposition se vier
      const cd = res.headers.get("content-disposition") || ""
      const m = cd.match(/filename="([^"]+)"/)
      const filename = m?.[1] || "aglivre-export.zip"

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError("Erro de conexão")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <h3 className="font-semibold text-foreground mb-1">
        Baixar meus dados
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        Gera um ZIP com todos os seus dados (tenant, usuários, produtos,
        contas, vendas ML, custos, faturas). Atende o direito de
        portabilidade da LGPD.
      </p>
      <button
        onClick={onDownload}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold disabled:opacity-50 transition"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {loading ? "Gerando ZIP…" : "Baixar ZIP"}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
    </div>
  )
}
