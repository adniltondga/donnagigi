"use client"

import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { PlanosView } from "@/components/admin/billing/PlanosView"

export default function PlanosPage() {
  const router = useRouter()
  return (
    <div className="space-y-6">
      <PageHeader title="Planos" description="Escolha o plano ideal pro seu negócio no Mercado Livre." />
      <PlanosView onSuccess={() => router.push("/admin/configuracoes?tab=assinatura")} />
    </div>
  )
}
