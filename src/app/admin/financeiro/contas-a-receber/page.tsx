import { PageHeader } from "@/components/ui/page-header"
import { BillsTab } from "../_components"

export default function ContasAReceberPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="💰 Contas a receber"
        description="Lançamentos manuais (ex: venda fora do ML). Vendas ML em Relatórios; saldo MP em Financeiro &gt; Mercado Pago."
      />
      <BillsTab type="receivable" />
    </div>
  )
}
