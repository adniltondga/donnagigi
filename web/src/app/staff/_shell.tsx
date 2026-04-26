"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Headset, Users, LogOut, Tickets, Wrench } from "lucide-react"

interface StaffUser {
  name: string
  email: string
}

const NAV = [
  { href: "/staff/tickets", label: "Tickets", icon: Tickets },
  { href: "/staff/clientes", label: "Clientes", icon: Users },
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
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="w-64 bg-black border-r border-zinc-800 flex flex-col">
        <div className="h-16 flex items-center gap-2 px-4 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary-600 to-fuchsia-700 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">DGA Staff</p>
            <p className="text-[10px] text-zinc-500 -mt-0.5">painel interno</p>
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
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-zinc-800 p-3 space-y-1">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition"
          >
            <Headset className="w-4 h-4" />
            Voltar pro app cliente
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-950/40 hover:text-red-300 transition"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-zinc-100">Painel Staff</h1>
          <div className="text-right">
            <p className="text-sm font-medium text-zinc-100 leading-tight">{user.name}</p>
            <p className="text-xs text-zinc-500 leading-tight">{user.email}</p>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-zinc-950">
          <div className="max-w-7xl mx-auto px-6 py-8 text-zinc-100">{children}</div>
        </main>
      </div>
    </div>
  )
}
