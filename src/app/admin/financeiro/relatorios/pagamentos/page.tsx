import { PageHeader } from "@/components/ui/page-header"
import { FluxoDiarioReport } from "@/components/admin/FluxoDiarioReport"

export default function PagamentosReportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="📉 Previsão de pagamentos"
        description="Contas a pagar pendentes agrupadas por dia de vencimento, no período selecionado."
      />
      <FluxoDiarioReport kind="pagamentos" />
    </div>
  )
}
