"use client"

import dynamic from "next/dynamic"
import { useTheme } from "next-themes"

/**
 * Sonner é uma lib que renderiza <section> via portal direto no body.
 * Com SSR ativo isso causa hydration mismatch (React vê o <section>
 * inesperado vindo do client, sem par no servidor).
 *
 * Solução: dynamic import com ssr:false. O componente só é importado
 * e montado no cliente — zero markup do Sonner sai no SSR.
 */
const SonnerToaster = dynamic(
  () => import("sonner").then((m) => m.Toaster),
  { ssr: false },
)

/**
 * Wrapper que sincroniza o tema do Sonner com next-themes.
 *
 * Uso: import { toast } from "sonner" em qualquer componente:
 *   toast.success("...")
 *   toast.error("...")
 *   toast.promise(promise, { loading, success, error })
 */
export function Toaster() {
  const { resolvedTheme } = useTheme()
  return (
    <SonnerToaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      richColors
      closeButton
      position="top-right"
    />
  )
}
