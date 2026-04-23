import { redirect } from "next/navigation"

// Financeiro virou um grupo com 3 rotas. O index redireciona pra "Contas a pagar".
export default function FinanceiroIndex() {
  redirect("/admin/financeiro/contas-a-pagar")
}
