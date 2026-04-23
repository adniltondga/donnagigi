"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"

const TITLE_MAP: Array<{ prefix: string; title: string }> = [
  { prefix: "/admin/dashboard", title: "Dashboard" },
  { prefix: "/admin/relatorios/por-dia", title: "Relatório por dia" },
  { prefix: "/admin/relatorios/vendas-ml", title: "Vendas Mercado Livre" },
  { prefix: "/admin/relatorios-v2", title: "Relatório V2" },
  { prefix: "/admin/relatorios", title: "Relatórios" },
  { prefix: "/admin/previsao", title: "Previsão de recebimentos" },
  { prefix: "/admin/financeiro", title: "Financeiro" },
  { prefix: "/admin/custos-ml", title: "Custos do Mercado Livre" },
  { prefix: "/admin/integracao", title: "Integração Mercado Livre" },
  { prefix: "/admin/billing/planos", title: "Planos" },
  { prefix: "/admin/billing/assinatura", title: "Assinatura" },
  { prefix: "/admin/billing/faturas", title: "Faturas" },
  { prefix: "/admin/billing", title: "Assinatura" },
  { prefix: "/admin/products", title: "Produtos" },
]

function titleFor(path: string): string {
  for (const { prefix, title } of TITLE_MAP) {
    if (path.startsWith(prefix)) return title
  }
  return "agLivre"
}

interface Me {
  name: string
  email: string
  tenant: { name: string }
}

export function AppHeader({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const pathname = usePathname()
  const title = titleFor(pathname)
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => {})
  }, [])

  const firstLetter = (me?.name || "?").trim().charAt(0).toUpperCase()
  const firstName = (me?.name || "").split(" ")[0] || "Usuário"

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-700"
          aria-label="Abrir menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="hidden md:block text-xl font-semibold text-gray-900">{title}</h1>
      </div>

      <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
        <div className="hidden sm:block text-right">
          <p className="text-sm font-medium text-gray-900 leading-tight">{firstName}</p>
          {me?.tenant?.name && (
            <p className="text-xs text-gray-500 leading-tight">{me.tenant.name}</p>
          )}
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-600 to-fuchsia-700 flex items-center justify-center text-white font-semibold">
          {firstLetter}
        </div>
      </div>
    </header>
  )
}
