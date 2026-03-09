"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="font-bold text-primary-700">👜</span>
          </div>
          <h1 className="text-2xl font-bold">Donna Gigi</h1>
        </div>
        <nav className="flex gap-6">
          <Link href="/" className="hover:opacity-80 transition">
            Catálogo
          </Link>
          <Link href="/admin" className="hover:opacity-80 transition">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
