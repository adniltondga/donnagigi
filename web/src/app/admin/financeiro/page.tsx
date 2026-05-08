import { redirect } from "next/navigation"

// Index redireciona pro Painel — home unificada do financeiro.
export default function FinanceiroIndex() {
  redirect("/admin/financeiro/painel")
}
