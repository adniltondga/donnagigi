import { PageHeader } from "@/components/ui/page-header"
import { BillsTab } from "../_components"
import { MercadoPagoBalanceCard } from "@/components/admin/MercadoPagoBalanceCard"

export default function ContasAReceberPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="💰 Contas a receber" description="Receitas manuais e outras entradas (vendas ML vivem em Relatórios)." />
      <MercadoPagoBalanceCard />
      <BillsTab type="receivable" />
    </div>
  )
}
