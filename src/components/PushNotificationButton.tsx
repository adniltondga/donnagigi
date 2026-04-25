"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff, Loader } from "lucide-react"

/**
 * Converte VAPID public key (base64url) em Uint8Array — formato exigido
 * pelo PushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}

type Status = "loading" | "unsupported" | "denied" | "subscribed" | "available"

export function PushNotificationButton() {
  const [status, setStatus] = useState<Status>("loading")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      if (
        typeof window === "undefined" ||
        typeof Notification === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        if (!cancelled) setStatus("unsupported")
        return
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied")
        return
      }
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!cancelled) setStatus(sub ? "subscribed" : "available")
      } catch {
        if (!cancelled) setStatus("unsupported")
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = async () => {
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "available")
        return
      }
      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY ausente")
        setStatus("unsupported")
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      })
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) throw new Error("Falha ao registrar no servidor")
      setStatus("subscribed")
    } catch (err) {
      console.error("[push] falha ao ativar:", err)
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {})
        await sub.unsubscribe()
      }
      setStatus("available")
    } finally {
      setBusy(false)
    }
  }

  if (status === "loading" || status === "unsupported") return null

  if (status === "denied") {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <BellOff size={14} />
        <span>
          Notificações bloqueadas. Reabilite nas permissões do navegador.
        </span>
      </div>
    )
  }

  if (status === "subscribed") {
    return (
      <button
        onClick={disable}
        disabled={busy}
        className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 transition"
      >
        {busy ? <Loader size={14} className="animate-spin" /> : <Bell size={14} />}
        Notificações ativas — clique pra desativar
      </button>
    )
  }

  return (
    <button
      onClick={enable}
      disabled={busy}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50 transition"
    >
      {busy ? <Loader size={14} className="animate-spin" /> : <Bell size={14} />}
      Ativar notificações de vendas
    </button>
  )
}
