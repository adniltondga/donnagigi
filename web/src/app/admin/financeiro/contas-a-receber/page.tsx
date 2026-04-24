import { PageHeader } from "@/components/ui/page-header"
import { BillsTab } from "../_components"
import { MercadoPagoBalanceCard } from "@/components/admin/MercadoPagoBalanceCard"
import { MercadoPagoPendingList } from "@/components/admin/MercadoPagoPendingList"

export default function ContasAReceberPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="💰 Contas a receber" description="Receitas manuais e outras entradas (vendas ML vivem em Relatórios)." />
      <MercadoPagoBalanceCard />
      <MercadoPagoPendingList />
      <BillsTab type="receivable" />
    </div>
  )
}
