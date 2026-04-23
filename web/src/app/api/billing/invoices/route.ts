import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * Lista as faturas da subscription do tenant logado, mais recentes
 * primeiro.
 */
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const sub = await prisma.subscription.findUnique({
    where: { tenantId: session.tenantId },
    select: { id: true },
  })
  if (!sub) {
    return NextResponse.json({ data: [] })
  }

  const invoices = await prisma.invoice.findMany({
    where: { subscriptionId: sub.id },
    orderBy: { dueDate: "desc" },
  })

  return NextResponse.json({ data: invoices })
}
