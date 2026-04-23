import { PageHeader } from "@/components/ui/page-header"
import { BillsTab } from "../_components"

export default function ContasAPagarPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="💸 Contas a pagar" description="Despesas, impostos, fornecedores e marketplace." />
      <BillsTab type="payable" />
    </div>
  )
}
