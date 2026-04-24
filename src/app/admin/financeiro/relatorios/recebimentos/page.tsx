import { PageHeader } from "@/components/ui/page-header"
import { FluxoDiarioReport } from "@/components/admin/FluxoDiarioReport"

export default function RecebimentosReportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="📈 Previsão de recebimentos"
        description="Dinheiro a entrar por dia: liberações programadas do Mercado Pago + contas a receber manuais."
      />
      <FluxoDiarioReport kind="recebimentos" />
    </div>
  )
}
