import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"
import { StaffShell } from "./_shell"

/**
 * Layout exclusivo da área staff (DGA Digital). Roda no servidor pra
 * checar `isStaff` antes de renderizar — usuário comum nem chega ao
 * client. Visual diferente do admin do cliente (sidebar quase preta
 * + selo "DGA Staff") pra deixar claro que é uma área interna.
 */
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect("/admin/login?next=/staff")

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { isStaff: true, name: true, email: true },
  })
  if (!user?.isStaff) redirect("/admin/dashboard")

  return <StaffShell user={{ name: user.name, email: user.email }}>{children}</StaffShell>
}
