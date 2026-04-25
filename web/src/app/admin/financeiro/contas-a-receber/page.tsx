import { redirect } from "next/navigation"

export default function ContasAReceberRedirect() {
  redirect("/admin/financeiro/contas?tab=receivable")
}
