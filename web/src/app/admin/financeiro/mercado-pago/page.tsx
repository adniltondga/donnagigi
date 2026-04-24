import { PageHeader } from "@/components/ui/page-header"
import { MercadoPagoBalanceCard } from "@/components/admin/MercadoPagoBalanceCard"
import { MercadoPagoPendingList } from "@/components/admin/MercadoPagoPendingList"
import { MercadoPagoDisputedCard } from "@/components/admin/MercadoPagoDisputedCard"

export default function MercadoPagoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="💳 Mercado Pago"
        description="Total a liberar, retido por reclamação e cronograma de liberações da sua conta MP."
      />
      <MercadoPagoBalanceCard />
      <MercadoPagoDisputedCard />
      <MercadoPagoPendingList />
    </div>
  )
}
