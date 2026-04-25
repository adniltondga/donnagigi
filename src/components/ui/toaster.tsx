"use client"

import { useTheme } from "next-themes"
import { Toaster as SonnerToaster } from "sonner"

/**
 * Wrapper do Sonner que lê o tema atual do next-themes (class-based dark
 * mode) e propaga pro Sonner — assim os toasts seguem light/dark
 * sincronizado com o resto da app.
 *
 * Uso: importe `toast` de "sonner" em qualquer componente:
 *   toast.success("Conta atualizada")
 *   toast.error("Erro ao salvar")
 *   toast.info(...)
 *   toast.promise(promise, { loading, success, error })
 */
export function Toaster() {
  const { resolvedTheme } = useTheme()
  return (
    <SonnerToaster
      theme={(resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark"}
      richColors
      closeButton
      position="top-right"
    />
  )
}
