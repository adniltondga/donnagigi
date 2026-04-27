import prisma from "@/lib/prisma"
import { syncAndCacheMP } from "@/lib/mp"

async function main() {
  const integrations = await prisma.mPIntegration.findMany({
    select: { tenantId: true, tenant: { select: { name: true } } },
  })

  for (const i of integrations) {
    console.log(`\n>>> Sincronizando ${i.tenant.name} ...`)
    try {
      const r = await syncAndCacheMP(i.tenantId)
      console.log(`✓ Sucesso. Liberado: R$${r.releasedTotal} (${r.releasedCount} payments)`)
      console.log(`  A liberar: R$${r.unavailableBalance} (${r.pendingCount} payments)`)
      console.log(`  Em mediação: R$${r.disputedTotal} (${r.disputedCount})`)
    } catch (err) {
      console.error(`✗ Erro:`, err instanceof Error ? err.message : err)
    }
  }
}

main().finally(() => prisma.$disconnect())
