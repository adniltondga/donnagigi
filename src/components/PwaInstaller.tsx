"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISSED_KEY = "pwa-install-dismissed"
const DISMISS_DAYS = 30

/**
 * Registra o Service Worker e mostra um banner discreto convidando o
 * user a instalar o PWA. Comportamento:
 *  - Só registra SW em produção (em dev, HMR conflita).
 *  - beforeinstallprompt só dispara em browsers que suportam install
 *    (Chrome/Edge no desktop e Android). iOS Safari não dispara — esse
 *    caso é tratado num futuro Sprint 3 com instruções manuais.
 *  - Se o user dispensar, não pergunta de novo por 30 dias.
 */
export function PwaInstaller() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Registra SW APENAS em produção. Em dev, o SW cachea chunks
    // de _next/static que mudam a cada save — gera hydration mismatch
    // entre HTML novo e JS antigo do cache. Em prod os chunks têm hash
    // no nome, então cache nunca fica stale.
    const isProd = process.env.NODE_ENV === "production"
    const canRegister =
      isProd &&
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      window.location.protocol === "https:"

    if (canRegister) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          console.warn("[pwa] SW register falhou:", err)
        })
    }

    // Em dev: se houver SW antigo registrado de sessão anterior,
    // desregistra pra liberar o cache stale.
    if (
      !isProd &&
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister())
      })
    }

    const wasDismissedRecently = () => {
      const raw = localStorage.getItem(DISMISSED_KEY)
      if (!raw) return false
      const at = Number(raw)
      if (!Number.isFinite(at)) return false
      return Date.now() - at < DISMISS_DAYS * 86_400_000
    }

    const handler = (e: Event) => {
      e.preventDefault()
      if (wasDismissedRecently()) return
      setInstallEvent(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const onInstall = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === "dismissed") {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    }
    setShowBanner(false)
    setInstallEvent(null)
  }

  const onDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div
      role="dialog"
      aria-label="Instalar agLivre"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="w-10 h-10 shrink-0 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center">
        <Download size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">
          Instale o agLivre no seu celular
        </p>
        <p className="text-xs text-gray-600 mt-0.5">
          Acesse rápido suas vendas e receba notificações de novos pedidos.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={onInstall}
            className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            Instalar
          </button>
          <button
            onClick={onDismiss}
            className="text-gray-600 hover:text-gray-900 text-xs font-medium px-3 py-1.5 rounded-lg transition"
          >
            Agora não
          </button>
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Fechar"
        className="shrink-0 text-gray-400 hover:text-gray-700 transition"
      >
        <X size={16} />
      </button>
    </div>
  )
}
