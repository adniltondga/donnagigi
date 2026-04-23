"use client"

import { useEffect, useState } from "react"

export type UserRole = "OWNER" | "ADMIN" | "VIEWER"

/**
 * Hook client-side pra ler o papel do usuário logado a partir de /api/auth/me.
 * Usado pra esconder botões/tabs pra VIEWER.
 *
 * Retorna `null` enquanto carrega; depois OWNER, ADMIN ou VIEWER.
 * `canWrite` é verdade pra OWNER/ADMIN.
 */
export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.role) setRole(d.role as UserRole)
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  return {
    role,
    loading,
    canWrite: role === "OWNER" || role === "ADMIN",
    isOwner: role === "OWNER",
    isViewer: role === "VIEWER",
  }
}
