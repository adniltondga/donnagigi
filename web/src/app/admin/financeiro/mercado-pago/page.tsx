import { PageHeader } from "@/components/ui/page-header"
import { MercadoPagoClient } from "@/components/admin/MercadoPagoClient"

export default function MercadoPagoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="💳 Mercado Pago"
        description="Total a liberar, retido por reclamação e cronograma de liberações."
      />
      <MercadoPagoClient />
    </div>
  )
}
