import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

interface ReleasedDay {
  date: string
  total: number
  count: number
  payments?: Array<{ id: number; externalReference: string | null; netAmount: number }>
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ select: { id: true } })
  if (!tenant) throw new Error("sem tenant")
  const tenantId = tenant.id

  const mp = await prisma.mPIntegration.findUnique({
    where: { tenantId },
    select: { cachedReleasedDays: true, cachedReleasedTotal: true, cachedSyncedAt: true },
  })
  const days = (mp?.cachedReleasedDays as unknown as ReleasedDay[] | null) ?? []
  const allPayments = days.flatMap((d) => d.payments ?? [])

  const cacheOrderIds = new Set<string>()
  for (const p of allPayments) {
    if (p.externalReference) {
      cacheOrderIds.add(p.externalReference)
      cacheOrderIds.add(`order_${p.externalReference}`)
    }
  }

  // TODAS as bills receivable (paid + pending, exclui cancelled)
  const allBills = await prisma.bill.findMany({
    where: {
      tenantId,
      type: "receivable",
      category: "venda",
      NOT: { status: "cancelled" },
    },
    select: { amount: true, productCost: true, mlOrderId: true, status: true, paidDate: true },
  })

  const matched = allBills.filter((b) => b.mlOrderId && cacheOrderIds.has(b.mlOrderId))
  const unmatched = allBills.filter((b) => !(b.mlOrderId && cacheOrderIds.has(b.mlOrderId)))

  const matchedAmount = matched.reduce((s, b) => s + b.amount, 0)
  const matchedCmv = matched.reduce((s, b) => s + (b.productCost ?? 0), 0)
  const matchedPaid = matched.filter((b) => b.status === "paid").length
  const matchedPending = matched.filter((b) => b.status === "pending").length

  console.log(`=== MATCHING MP cache ↔ bills receivable ===`)
  console.log(`Bills com payment liberado pelo MP: ${matched.length} (paid=${matchedPaid}, pending=${matchedPending})`)
  console.log(`  Soma amount: R$ ${matchedAmount.toFixed(2)}`)
  console.log(`  Soma CMV:    R$ ${matchedCmv.toFixed(2)}`)

  console.log(`\nBills SEM match (payment não está no cache MP): ${unmatched.length}`)
  console.log(`  Soma amount: R$ ${unmatched.reduce((s, b) => s + b.amount, 0).toFixed(2)}`)
  console.log(`  Soma CMV:    R$ ${unmatched.reduce((s, b) => s + (b.productCost ?? 0), 0).toFixed(2)}`)

  // Bills "atrasadas" - status=pending mas o payment já liberou
  const atrasadas = matched.filter((b) => b.status === "pending")
  console.log(`\n=== BILLS ATRASADAS (cron release-and-refunds não flipou) ===`)
  console.log(`${atrasadas.length} bills com payment MP já liberado mas status=pending`)
  console.log(`  Soma amount: R$ ${atrasadas.reduce((s, b) => s + b.amount, 0).toFixed(2)}`)
  console.log(`  Soma CMV:    R$ ${atrasadas.reduce((s, b) => s + (b.productCost ?? 0), 0).toFixed(2)}`)

  // Calcular lucro liberado correto
  const mpReleasedTotal = mp?.cachedReleasedTotal ?? 0
  const lucroLiberadoReal = mpReleasedTotal - matchedCmv
  console.log(`\n=== FÓRMULA NOVA (CMV matching real) ===`)
  console.log(`  MP liberado:          R$ ${mpReleasedTotal.toFixed(2)}`)
  console.log(`  − CMV das vendas liberadas (matching): R$ ${matchedCmv.toFixed(2)}`)
  console.log(`  = Lucro liberado:     R$ ${lucroLiberadoReal.toFixed(2)}`)

  // Despesas + reposição
  const repoTotal = await prisma.bill.findMany({
    where: { tenantId, type: "payable", status: "paid", category: "reposicao_estoque" },
    select: { amount: true },
  }).then((bs) => bs.reduce((s, b) => s + b.amount, 0))
  const aporteRoot = await prisma.billCategory.findFirst({
    where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
    select: { id: true, children: { select: { id: true } } },
  })
  const aporteIds = aporteRoot ? [aporteRoot.id, ...aporteRoot.children.map((c) => c.id)] : []
  const despesasTotal = await prisma.bill.findMany({
    where: {
      tenantId,
      type: "payable",
      status: "paid",
      category: { not: "reposicao_estoque" },
      NOT: [{ billCategoryId: { in: aporteIds.length > 0 ? aporteIds : ["__none__"] } }],
    },
    select: { amount: true },
  }).then((bs) => bs.reduce((s, b) => s + b.amount, 0))

  console.log(`\n=== CONTAS FINAIS ===`)
  console.log(`Reposição paga lifetime: R$ ${repoTotal.toFixed(2)}`)
  console.log(`Despesas pagas lifetime: R$ ${despesasTotal.toFixed(2)}`)
  console.log(`Saldo MP esperado: ${mpReleasedTotal.toFixed(2)} − ${repoTotal.toFixed(2)} − ${despesasTotal.toFixed(2)} = R$ ${(mpReleasedTotal - repoTotal - despesasTotal).toFixed(2)}`)
  console.log(`Pró-labore (lucro − despesas): R$ ${(lucroLiberadoReal - despesasTotal).toFixed(2)}`)
}

main().finally(() => prisma.$disconnect())
