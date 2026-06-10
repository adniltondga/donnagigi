import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const integration = await prisma.mPIntegration.findFirst()
  if (!integration) throw new Error("sem integração MP")
  const token = integration.accessToken

  // Buscar todos os payments dos últimos 180d sem filtro de operation_type
  // e listar os operation_types únicos pra ver quais existem
  const opTypes = new Map<string, { count: number; sumNet: number; sumGross: number }>()
  let offset = 0
  const LIMIT = 50
  const MAX = 500
  while (offset < MAX) {
    const q = new URLSearchParams({
      sort: "date_created",
      criteria: "desc",
      range: "date_created",
      begin_date: "NOW-180DAYS",
      end_date: "NOW",
      limit: String(LIMIT),
      offset: String(offset),
    })
    const url = `https://api.mercadopago.com/v1/payments/search?${q.toString()}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
    if (!res.ok) {
      console.log(`status ${res.status}: ${await res.text()}`)
      break
    }
    const data = (await res.json()) as {
      results?: Array<{
        operation_type: string
        status: string
        transaction_amount: number
        transaction_details?: { net_received_amount?: number }
      }>
      paging?: { total: number }
    }
    const batch = data.results ?? []
    if (batch.length === 0) break
    for (const p of batch) {
      const key = `${p.operation_type}/${p.status}`
      const slot = opTypes.get(key) ?? { count: 0, sumNet: 0, sumGross: 0 }
      slot.count++
      slot.sumNet += p.transaction_details?.net_received_amount ?? 0
      slot.sumGross += p.transaction_amount
      opTypes.set(key, slot)
    }
    offset += LIMIT
    if (data.paging && offset >= data.paging.total) break
  }

  console.log("Operation types encontrados:")
  for (const [key, v] of Array.from(opTypes.entries()).sort()) {
    console.log(
      `  ${key.padEnd(40)} count=${v.count}  net=R$ ${v.sumNet.toFixed(2)}  gross=R$ ${v.sumGross.toFixed(2)}`,
    )
  }
}

main().finally(() => prisma.$disconnect())
