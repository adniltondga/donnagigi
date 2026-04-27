"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Menu, Settings, Headset, LogOut, ChevronDown } from "lucide-react"
import { NotificationBell } from "./NotificationBell"
import { ThemeToggle } from "./ThemeToggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

const TITLE_MAP: Array<{ prefix: string; title: string }> = [
  { prefix: "/admin/dashboard", title: "Dashboard" },
  { prefix: "/admin/relatorios/por-dia", title: "Relatório por dia" },
  { prefix: "/admin/relatorios/vendas-ml", title: "Vendas Mercado Livre" },
  { prefix: "/admin/relatorios-v2", title: "Relatório V2" },
  { prefix: "/admin/relatorios", title: "Relatórios" },
  { prefix: "/admin/previsao", title: "Previsão de recebimentos" },
  { prefix: "/admin/financeiro", title: "Financeiro" },
  { prefix: "/admin/integracao", title: "Integração Mercado Livre" },
  { prefix: "/admin/billing/planos", title: "Planos" },
  { prefix: "/admin/billing/assinatura", title: "Assinatura" },
  { prefix: "/admin/billing/faturas", title: "Faturas" },
  { prefix: "/admin/billing", title: "Assinatura" },
  { prefix: "/admin/suporte", title: "Suporte" },
  { prefix: "/admin/produtos/anuncios", title: "Anúncios" },
  { prefix: "/admin/produtos/custo", title: "Anúncios" },
  { prefix: "/admin/produtos/recomendacoes", title: "Recomendações de compra" },
  { prefix: "/admin/produtos/relatorio", title: "Relatório de produtos" },
  { prefix: "/admin/produtos", title: "Produtos" },
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
  const router = useRouter()
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

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {}
    router.push("/admin/login")
  }

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-accent text-foreground"
          aria-label="Abrir menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="hidden md:block text-xl font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-3 pl-3 ml-1 border-l border-border hover:bg-muted/40 rounded-r-lg pr-1 py-1 transition focus:outline-none focus:ring-2 focus:ring-primary-600"
              aria-label="Menu da conta"
            >
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-foreground leading-tight">{firstName}</p>
                {me?.tenant?.name && (
                  <p className="text-xs text-muted-foreground leading-tight">{me.tenant.name}</p>
                )}
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-600 to-fuchsia-700 flex items-center justify-center text-white font-semibold">
                {firstLetter}
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {me && (
              <>
                <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
                  <span
                    className="text-xs font-semibold text-foreground truncate"
                    title={me.name}
                  >
                    {me.name}
                  </span>
                  <span
                    className="text-[11px] text-muted-foreground truncate"
                    title={me.email}
                  >
                    {me.email}
                  </span>
                  {me.tenant?.name && (
                    <span
                      className="text-[11px] text-muted-foreground truncate"
                      title={me.tenant.name}
                    >
                      {me.tenant.name}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild>
              <Link href="/admin/configuracoes" className="flex items-center gap-2 cursor-pointer">
                <Settings className="w-4 h-4" />
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/suporte" className="flex items-center gap-2 cursor-pointer">
                <Headset className="w-4 h-4" />
                Suporte
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-600 focus:text-red-700 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
