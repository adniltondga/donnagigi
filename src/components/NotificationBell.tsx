"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, Check, ShoppingBag, DollarSign, AlertCircle } from "lucide-react"

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  createdAt: string
}

interface Response {
  items: Notification[]
  unreadCount: number
}

const POLL_INTERVAL_MS = 30_000

function iconFor(type: string) {
  if (type === "sale") return ShoppingBag
  if (type === "mp_release") return DollarSign
  if (type === "refund") return AlertCircle
  return Bell
}

function colorFor(type: string) {
  if (type === "sale") return "text-emerald-600 bg-emerald-50"
  if (type === "mp_release") return "text-sky-600 bg-sky-50"
  if (type === "refund") return "text-rose-600 bg-rose-50"
  return "text-gray-600 bg-gray-100"
}

function formatTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, now - then)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "agora"
  if (min < 60) return `há ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `há ${hr}h`
  const d = Math.floor(hr / 24)
  if (d < 30) return `há ${d}d`
  return new Date(iso).toLocaleDateString("pt-BR")
}

export function NotificationBell() {
  const [data, setData] = useState<Response | null>(null)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" })
      if (res.ok) setData(await res.json())
    } catch {
      // ignore — poll roda de novo em 30s
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  const markOne = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" })
    load()
  }

  const markAll = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" })
    load()
  }

  const unread = data?.unreadCount ?? 0
  const items = data?.items ?? []

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-700"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Notificações</p>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Nenhuma notificação ainda
              </div>
            ) : (
              items.map((n) => {
                const Icon = iconFor(n.type)
                const iconClass = colorFor(n.type)
                const content = (
                  <div
                    className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition ${
                      !n.read ? "bg-blue-50/30" : ""
                    }`}
                    onClick={() => !n.read && markOne(n.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${!n.read ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-1">{formatTime(n.createdAt)}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-primary-600 shrink-0 mt-2" />}
                    </div>
                  </div>
                )
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
