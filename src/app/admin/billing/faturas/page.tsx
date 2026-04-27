"use client"

import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { FaturasView } from "@/components/admin/billing/FaturasView"

export default function FaturasPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Faturas"
        description="Histórico de cobranças da sua assinatura."
        actions={
          <Link
            href="/admin/configuracoes?tab=assinatura"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            ← Voltar
          </Link>
        }
      />
      <FaturasView />
    </div>
  )
}
