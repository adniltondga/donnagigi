"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

/**
 * Botão pra alternar entre claro e escuro. Usa next-themes pra persistir
 * em localStorage e respeitar a preferência do sistema na primeira visita.
 *
 * `mounted` evita flash de tema errado durante hydration: na primeira
 * renderização do cliente, theme é undefined (servidor) ou já resolvido
 * (cliente após hydration).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted ? resolvedTheme === "dark" : false
  const next = isDark ? "light" : "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition"
    >
      {mounted ? (
        isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />
      ) : (
        // Placeholder neutro pra não piscar durante hydration
        <Sun className="w-5 h-5 opacity-0" />
      )}
    </button>
  )
}
