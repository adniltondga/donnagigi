import prisma from "@/lib/prisma"

async function main() {
  const integrations = await prisma.mPIntegration.findMany({
    select: {
      tenantId: true,
      mpUserId: true,
      cachedReleasedDays: true,
      cachedSyncedAt: true,
      tenant: { select: { name: true, slug: true } },
    },
  })

  for (const i of integrations) {
    console.log(`\n=== Tenant ${i.tenant.name} (${i.tenant.slug}) ===`)
    console.log(`mpUserId: ${i.mpUserId}`)
    console.log(`cachedSyncedAt: ${i.cachedSyncedAt}`)

    type Day = {
      date: string
      total: number
      count: number
      payments: Array<{
        id: number
        description: string
        netAmount: number
        externalReference: string | null
        paymentMethodId: string | null
        buyer: string | null
      }>
    }
    const days = (i.cachedReleasedDays as unknown as Day[]) ?? []
    console.log(`released days: ${days.length}`)

    const allPayments = days.flatMap((d) => d.payments ?? [])
    console.log(`released payments total: ${allPayments.length}`)

    for (const p of allPayments) {
      console.log(
        `  [${p.id}] ${p.paymentMethodId ?? "??"} | R$${p.netAmount.toFixed(2)} | ext=${p.externalReference ?? "—"} | buyer=${p.buyer ?? "—"}`,
      )
      console.log(`     "${p.description.slice(0, 80)}"`)
    }
  }
}

main().finally(() => prisma.$disconnect())
