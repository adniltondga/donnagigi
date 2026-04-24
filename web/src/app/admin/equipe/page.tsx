import { redirect } from "next/navigation"

export default function EquipeRedirect() {
  redirect("/admin/configuracoes?tab=equipe")
}
