import { PageHeader } from "@/components/ui/page-header"
import { BillsTab } from "../_components"

export default function ContasAReceberPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="💰 Contas a receber" description="Receitas manuais e outras entradas (vendas ML vivem em Relatórios)." />
      <BillsTab type="receivable" />
    </div>
  )
}
