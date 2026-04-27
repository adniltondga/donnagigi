"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Users, LogOut, Tickets, Wrench, Mail, Activity } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"

interface StaffUser {
  name: string
  email: string
}

const NAV = [
  { href: "/staff/tickets", label: "Tickets", icon: Tickets },
  { href: "/staff/clientes", label: "Clientes", icon: Users },
  { href: "/staff/waitlist", label: "Lista de espera", icon: Mail },
  { href: "/staff/api-usage", label: "API Usage", icon: Activity },
]

export function StaffShell({ user, children }: { user: StaffUser; children: React.ReactNode }) {
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
    <div className="flex h-screen overflow-hidden bg-app-bg text-foreground">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="h-16 flex items-center gap-2 px-4 border-b border-border">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary-600 to-fuchsia-700 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-foreground">DGA Staff</p>
            <p className="text-[10px] text-muted-foreground -mt-0.5">painel interno</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                  active
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 transition"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-foreground">Painel Staff</h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="text-right pl-3 border-l border-border">
              <p className="text-sm font-medium text-foreground leading-tight">{user.name}</p>
              <p className="text-xs text-muted-foreground leading-tight">{user.email}</p>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-app-bg">
          <div className="max-w-7xl mx-auto px-6 py-8 text-foreground">{children}</div>
        </main>
      </div>
    </div>
  )
}
