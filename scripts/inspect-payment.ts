import prisma from "@/lib/prisma"
import { getMPIntegrationForTenant } from "@/lib/mp"

async function main() {
  const ids = ["149689186482", "155209423554"]
  const integrations = await prisma.mPIntegration.findMany({
    select: { tenantId: true, mpUserId: true },
  })
  const i = integrations[0]
  if (!i) {
    console.log("Sem integração")
    return
  }
  const fresh = await getMPIntegrationForTenant(i.tenantId)
  if (!fresh) return
  console.log(`mpUserId (collector esperado): ${i.mpUserId}\n`)

  for (const id of ids) {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${fresh.accessToken}` },
    })
    if (!r.ok) {
      console.log(`[${id}] HTTP ${r.status}`)
      continue
    }
    type Payment = {
      id: number
      description?: string
      operation_type?: string
      external_reference?: string | null
      transaction_amount?: number
      collector_id?: number | string
      collector?: { id?: number | string }
      payer?: { id?: number | string; email?: string; first_name?: string; last_name?: string }
      additional_info?: { items?: Array<{ id?: string; title?: string }> }
    }
    const p = (await r.json()) as Payment
    console.log(`[${p.id}] op=${p.operation_type} amount=${p.transaction_amount}`)
    console.log(`  description: "${p.description ?? "(none)"}"`)
    console.log(`  external_reference: ${p.external_reference ?? "(none)"}`)
    console.log(`  collector.id (raw): ${JSON.stringify(p.collector ?? p.collector_id)}`)
    console.log(`  payer: id=${p.payer?.id} email=${p.payer?.email ?? ""} name=${p.payer?.first_name ?? ""} ${p.payer?.last_name ?? ""}`)
    if (p.additional_info?.items?.length) {
      console.log(`  items: ${p.additional_info.items.map((x) => x.title).join(", ")}`)
    }
    console.log()
  }
}

main().finally(() => prisma.$disconnect())
