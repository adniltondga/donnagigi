import { PageHeader } from "@/components/ui/page-header"
import { MercadoPagoBalanceCard } from "@/components/admin/MercadoPagoBalanceCard"
import { MercadoPagoPendingList } from "@/components/admin/MercadoPagoPendingList"

export default function MercadoPagoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="💳 Mercado Pago"
        description="Total a liberar e cronograma de liberações da sua conta MP, puxados direto da API."
      />
      <MercadoPagoBalanceCard />
      <MercadoPagoPendingList />
    </div>
  )
}
