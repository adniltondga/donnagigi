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
      // Limpar localStorage
      localStorage.removeItem('adminToken')
      router.push('/admin/login')
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      // Mesmo com erro, limpar localStorage e redirecionar
      localStorage.removeItem('adminToken')
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
                href="/admin/categories"
                className={`block px-4 py-2 rounded-lg transition ${
                  isActive("/admin/categories")
                    ? "bg-primary-500 text-white"
                    : "text-admin-300 hover:bg-admin-700"
                }`}
              >
                🏷️ Categorias
              </Link>
            </li>
            <li>
              <Link
                href="/admin/suppliers"
                className={`block px-4 py-2 rounded-lg transition ${
                  isActive("/admin/suppliers")
                    ? "bg-primary-500 text-white"
                    : "text-admin-300 hover:bg-admin-700"
                }`}
              >
                📦 Fornecedores
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-admin-400 text-xs font-semibold uppercase mb-3">
            Catálogo
          </p>
          <ul className="space-y-2">
            <li>
              <Link
                href="/admin/device-models"
                className={`block px-4 py-2 rounded-lg transition ${
                  isActive("/admin/device-models")
                    ? "bg-primary-500 text-white"
                    : "text-admin-300 hover:bg-admin-700"
                }`}
              >
                📱 Dispositivos
              </Link>
            </li>
            <li>
              <Link
                href="/admin/device-colors"
                className={`block px-4 py-2 rounded-lg transition ${
                  isActive("/admin/device-colors")
                    ? "bg-primary-500 text-white"
                    : "text-admin-300 hover:bg-admin-700"
                }`}
              >
                🎨 Cores
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <div className="p-6 border-t border-admin-700">
        <button
          onClick={handleLogout}
          className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white px-4 py-2 rounded-lg transition font-semibold shadow-lg hover:shadow-xl"
        >
          🚪 Sair
        </button>
      </div>
    </aside>
  );
}
