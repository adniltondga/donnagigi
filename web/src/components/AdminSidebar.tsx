"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  DollarSign,
  ChevronDown,
  X,
  ShoppingBag,
  LogOut,
  type LucideIcon,
} from "lucide-react"

interface MenuItem {
  label: string
  href?: string
  icon: LucideIcon
  /** Subitens. Se presente, o item vira grupo expansível. */
  children?: Array<{ label: string; href: string }>
  /** Função opcional pra decidir se está ativo. Default: match exato do href. */
  isActive?: (pathname: string) => boolean
}

const MENU: MenuItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  {
    label: "Financeiro",
    icon: DollarSign,
    isActive: (p) => p.startsWith("/admin/financeiro"),
    children: [
      { label: "Painel", href: "/admin/financeiro/painel" },
      { label: "Contas", href: "/admin/financeiro/contas" },
      { label: "Relatórios", href: "/admin/financeiro/relatorios" },
    ],
  },
  {
    label: "Produtos",
    icon: ShoppingBag,
    isActive: (p) => p.startsWith("/admin/produtos"),
    children: [
      { label: "Anúncios", href: "/admin/produtos/anuncios" },
      { label: "Recomendações", href: "/admin/produtos/recomendacoes" },
      { label: "Ranking", href: "/admin/produtos/ranking" },
      { label: "Relatório", href: "/admin/produtos/relatorio" },
    ],
  },
]

// Suporte / Configurações / Sair foram movidos pro dropdown do
// avatar (AppHeader) — pattern moderno de SaaS.

interface AdminSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {}
    localStorage.removeItem("adminToken")
    router.push("/admin/login")
  }

  // Estado de grupos expandidos. Auto-abre o grupo que contém a página atual.
  const initialExpanded = useMemo(() => {
    const set = new Set<string>()
    for (const item of MENU) {
      if (item.children && item.children.some((c) => pathname.startsWith(c.href))) {
        set.add(item.label)
      }
    }
    return set
  }, [pathname])
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded)
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      initialExpanded.forEach((v) => next.add(v))
      return next
    })
  }, [initialExpanded])
  const toggleGroup = (label: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link href="/admin/dashboard" className="flex items-center gap-2" onClick={onClose}>
            <div className="bg-primary-600 p-2 rounded-lg">
              <span className="text-white font-bold text-sm">aL</span>
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">
              ag<span className="text-primary-600 dark:text-primary-400">Livre</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu items */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {MENU.map((item) => {
            const Icon = item.icon
            const active = item.isActive ? item.isActive(pathname) : pathname === item.href

            // Grupo expansível com subitens
            if (item.children && item.children.length > 0) {
              const isOpenGroup = expanded.has(item.label)
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.label)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200
                      ${
                        active
                          ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium"
                          : "text-foreground hover:bg-accent hover:text-foreground"
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-primary-600 dark:text-primary-400" : "text-muted-foreground"}`} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform ${isOpenGroup ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpenGroup && (
                    <div className="mt-1 ml-4 pl-3 border-l border-border space-y-1">
                      {item.children.map((child) => {
                        const childActive = pathname.startsWith(child.href)
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onClose}
                            className={`
                              block px-3 py-2 rounded-lg text-sm transition-colors
                              ${
                                childActive
                                  ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium"
                                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
                              }
                            `}
                          >
                            {child.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            // Item simples (com href)
            return (
              <Link
                key={item.href}
                href={item.href!}
                onClick={onClose}
                className={`
                  relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200
                  ${
                    active
                      ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium"
                      : "text-foreground hover:bg-accent hover:text-foreground"
                  }
                `}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-primary-600 dark:text-primary-400" : "text-muted-foreground"}`} />
                <span className="flex-1">{item.label}</span>
                {active && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-600 rounded-full" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Sair */}
        <div className="border-t border-border p-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>

        {/* Status */}
        <div className="border-t border-border dark:border-gray-800 p-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-muted-foreground">Sistema online</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">v0.1.0</p>
        </div>
      </aside>
    </>
  )
}
