"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { AdminSidebar } from "@/components/AdminSidebar"
import { AppHeader } from "@/components/AppHeader"
import { SubscriptionGuard } from "@/components/SubscriptionGuard"
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog"

// Roteamento staff vs cliente acontece no middleware.ts (lê isStaff do JWT
// e redireciona /admin/* → /staff pra staff, /staff/* → /admin/dashboard
// pra cliente). Aqui o layout só renderiza o admin do cliente normal.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isLoginPage = pathname === "/admin/login"

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-app-bg">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <SubscriptionGuard>{children}</SubscriptionGuard>
          </div>
        </main>
      </div>
      <ConfirmDialogHost />
    </div>
  )
}
