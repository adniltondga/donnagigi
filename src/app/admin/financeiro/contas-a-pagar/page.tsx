import { redirect } from "next/navigation"

export default function ContasAPagarRedirect() {
  redirect("/admin/financeiro/contas?tab=payable")
}
