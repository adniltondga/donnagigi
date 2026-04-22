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
                href="/admin/financeiro"
                className={`block px-4 py-2 rounded-lg transition ${
                  pathname.startsWith("/admin/financeiro")
                    ? "bg-primary-500 text-white"
                    : "text-admin-300 hover:bg-admin-700"
                }`}
              >
                💳 Financeiro
              </Link>
            </li>
            <li>
              <Link
                href="/admin/custos-ml"
                className={`block px-4 py-2 rounded-lg transition ${
                  isActive("/admin/custos-ml")
                    ? "bg-primary-500 text-white"
                    : "text-admin-300 hover:bg-admin-700"
                }`}
              >
                💰 Custos ML
              </Link>
            </li>
            <li>
              <Link
                href="/admin/relatorios"
                className={`block px-4 py-2 rounded-lg transition ${
                  pathname.startsWith("/admin/relatorios")
                    ? "bg-primary-500 text-white"
                    : "text-admin-300 hover:bg-admin-700"
                }`}
              >
                📈 Relatórios
              </Link>
            </li>
          </ul>
        </div>



        <div>
          <p className="text-admin-400 text-xs font-semibold uppercase mb-3">
            Integrações
          </p>
          <ul className="space-y-2">
            <li>
              <Link
                href="/admin/integracao"
                className={`block px-4 py-2 rounded-lg transition ${
                  isActive("/admin/integracao")
                    ? "bg-primary-500 text-white"
                    : "text-admin-300 hover:bg-admin-700"
                }`}
              >
                🔗 Mercado Livre
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
