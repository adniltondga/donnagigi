"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  BarChart3,
  DollarSign,
  Package,
  Tag,
  Plug,
  CreditCard,
  LogOut,
  X,
  type LucideIcon,
} from "lucide-react"

interface MenuItem {
  label: string
  href: string
  icon: LucideIcon
  /**
   * Função opcional pra decidir se o item está ativo. Default: match exato.
   */
  isActive?: (pathname: string) => boolean
}

const MENU: MenuItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  {
    label: "Relatórios",
    href: "/admin/relatorios",
    icon: BarChart3,
    isActive: (p) => p.startsWith("/admin/relatorios") || p === "/admin/previsao",
  },
  { label: "Financeiro", href: "/admin/financeiro", icon: DollarSign },
  { label: "Produtos", href: "/admin/products", icon: Package, isActive: (p) => p.startsWith("/admin/products") },
  { label: "Custos ML", href: "/admin/custos-ml", icon: Tag },
  { label: "Integração ML", href: "/admin/integracao", icon: Plug },
  {
    label: "Assinatura",
    href: "/admin/billing/assinatura",
    icon: CreditCard,
    isActive: (p) => p.startsWith("/admin/billing"),
  },
]

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
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          <Link href="/admin/dashboard" className="flex items-center gap-2" onClick={onClose}>
            <div className="bg-primary-600 p-2 rounded-lg">
              <span className="text-white font-bold text-sm">aL</span>
            </div>
            <span className="text-lg font-bold text-gray-900 tracking-tight">
              ag<span className="text-primary-600">Livre</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
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
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200
                  ${
                    active
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  }
                `}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-primary-600" : "text-gray-400"}`} />
                <span className="flex-1">{item.label}</span>
                {active && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-600 rounded-full" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>

        {/* Status */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500">Sistema online</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">v0.1.0</p>
        </div>
      </aside>
    </>
  )
}
