"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Toaster as SonnerToaster } from "sonner"

/**
 * Wrapper do Sonner que lê o tema atual do next-themes (class-based dark
 * mode) e propaga pro Sonner — assim os toasts seguem light/dark
 * sincronizado com o resto da app.
 *
 * `mounted` evita hydration mismatch: durante SSR e primeira render do
 * cliente, o resolvedTheme ainda é undefined; só depois do effect do
 * next-themes resolver é que viramos com o tema correto.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Não renderiza nada até o tema ser resolvido — Sonner é overlay,
  // não causa shift de layout.
  if (!mounted) return null

  return (
    <SonnerToaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      richColors
      closeButton
      position="top-right"
    />
  )
}
