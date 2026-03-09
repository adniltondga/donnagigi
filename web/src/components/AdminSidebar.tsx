"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => pathname === href;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      })
      router.push('/admin/login')
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      // Mesmo com erro, redirecionar
      router.push('/admin/login')
    }
  };

  return (
    <aside className="w-64 bg-admin-800 text-white min-h-screen shadow-lg flex flex-col">
      <div className="p-6 border-b border-admin-700">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
            <span className="font-bold">👜</span>
          </div>
          <h1 className="text-xl font-bold">Donna Gigi</h1>
        </div>
        <p className="text-admin-400 text-sm">Admin Dashboard</p>
      </div>

      <nav className="flex-1 p-6 space-y-4">
        <div>
          <p className="text-admin-400 text-xs font-semibold uppercase mb-3">
            Menu
          </p>
          <ul className="space-y-2">
            <li>
              <Link
                href="/admin/dashboard"
                className={`block px-4 py-2 rounded-lg transition ${
                  isActive("/admin/dashboard")
                    ? "bg-primary-500 text-white"
                    : "text-admin-300 hover:bg-admin-700"
                }`}
              >
                📊 Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/admin/products"
                className={`block px-4 py-2 rounded-lg transition ${
                  isActive("/admin/products")
                    ? "bg-primary-500 text-white"
                    : "text-admin-300 hover:bg-admin-700"
                }`}
              >
                📦 Produtos
              </Link>
            </li>
            <li>
              <Link
                href="/admin/orders"
                className={`block px-4 py-2 rounded-lg transition ${
                  isActive("/admin/orders")
                    ? "bg-primary-500 text-white"
                    : "text-admin-300 hover:bg-admin-700"
                }`}
              >
                🛒 Pedidos
              </Link>
            </li>
            <li>
              <Link
                href="/admin/analytics"
                className={`block px-4 py-2 rounded-lg transition ${
                  isActive("/admin/analytics")
                    ? "bg-primary-500 text-white"
                    : "text-admin-300 hover:bg-admin-700"
                }`}
              >
                📈 Análise
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <div className="p-6 border-t border-admin-700">
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition font-semibold"
        >
          🚪 Sair
        </button>
      </div>
    </aside>
  );
}
