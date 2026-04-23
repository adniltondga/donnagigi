import { PageHeader } from "@/components/ui/page-header"
import { CategoriasTab } from "../_components"

export default function CategoriasFinanceiroPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="📂 Categorias" description="Organize suas contas em categorias e subcategorias (ex: Impostos > DAS)." />
      <CategoriasTab />
    </div>
  )
}
