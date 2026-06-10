import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.findFirst({ select: { id: true, name: true } })
  if (!tenant) throw new Error("nenhum tenant")
  const tenantId = tenant.id
  console.log(`Tenant: ${tenant.name} (${tenantId})`)
  console.log("=".repeat(70))

  // 1) Bills payable - todas pagas, agrupando por categoria
  const billsPaid = await prisma.bill.findMany({
    where: { tenantId, type: "payable", status: "paid" },
    select: {
      id: true,
      description: true,
      amount: true,
      paidDate: true,
      dueDate: true,
      category: true,
      billCategoryId: true,
      billCategory: { select: { name: true, parent: { select: { name: true } } } },
    },
    orderBy: { paidDate: "asc" },
  })

  // 2) Reposicao
  const reposicao = billsPaid.filter((b) => b.category === "reposicao_estoque")
  const reposicaoTotal = reposicao.reduce((s, b) => s + b.amount, 0)
  console.log(`\n[REPOSIÇÃO] ${reposicao.length} bills, total R$ ${reposicaoTotal.toFixed(2)}`)
  for (const b of reposicao) {
    console.log(
      `  ${b.paidDate?.toISOString().slice(0, 10)}  ${b.description?.padEnd(30)}  R$ ${b.amount.toFixed(2)}  (${b.id})`,
    )
  }

  // 3) Despesas (paid, exceto aporte e reposicao)
  const aporteRoot = await prisma.billCategory.findFirst({
    where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
    select: { id: true, children: { select: { id: true, name: true } } },
  })
  const aporteIds = aporteRoot
    ? [aporteRoot.id, ...aporteRoot.children.map((c) => c.id)]
    : []
  const despesas = billsPaid.filter(
    (b) =>
      b.category !== "reposicao_estoque" &&
      !(b.billCategoryId && aporteIds.includes(b.billCategoryId)),
  )
  const despesasTotal = despesas.reduce((s, b) => s + b.amount, 0)
  console.log(`\n[DESPESAS] ${despesas.length} bills, total R$ ${despesasTotal.toFixed(2)}`)
  for (const b of despesas) {
    const cat = b.billCategory
      ? b.billCategory.parent
        ? `${b.billCategory.parent.name} · ${b.billCategory.name}`
        : b.billCategory.name
      : `[cat=${b.category}]`
    console.log(
      `  ${b.paidDate?.toISOString().slice(0, 10)}  ${b.description?.padEnd(35)}  ${cat.padEnd(35)}  R$ ${b.amount.toFixed(2)}  (${b.id})`,
    )
  }

  // 4) Aportes / amortizações
  const aportePagos = billsPaid.filter(
    (b) => b.billCategoryId && aporteIds.includes(b.billCategoryId),
  )
  const aporteTotal = aportePagos.reduce((s, b) => s + b.amount, 0)
  console.log(`\n[APORTES PAGOS] ${aportePagos.length} bills, total R$ ${aporteTotal.toFixed(2)}`)
  for (const b of aportePagos) {
    const cat = b.billCategory ? b.billCategory.name : `[cat=${b.category}]`
    console.log(
      `  ${b.paidDate?.toISOString().slice(0, 10)}  ${b.description?.padEnd(30)}  ${cat.padEnd(20)}  R$ ${b.amount.toFixed(2)}  (${b.id})`,
    )
  }

  // 5) Detector de duplicatas — mesma data + mesmo valor
  console.log(`\n[SUSPEITOS DE DUPLICATA] (mesmo valor, datas próximas)`)
  const groups = new Map<string, typeof billsPaid>()
  for (const b of billsPaid) {
    const key = `${b.amount.toFixed(2)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(b)
  }
  for (const [val, arr] of groups) {
    if (arr.length < 2) continue
    console.log(`  --- R$ ${val} (${arr.length}x) ---`)
    for (const b of arr) {
      const cat = b.billCategory
        ? b.billCategory.parent
          ? `${b.billCategory.parent.name} · ${b.billCategory.name}`
          : b.billCategory.name
        : `cat=${b.category}`
      console.log(
        `    ${b.paidDate?.toISOString().slice(0, 10)}  ${b.description?.padEnd(35)}  ${cat.padEnd(35)}  (${b.id})`,
      )
    }
  }

  // 6) Caixa = MP liberado − reposição paga − despesas − aportes pagos
  const mp = await prisma.mPIntegration.findUnique({
    where: { tenantId },
    select: { cachedReleasedTotal: true, cachedReleasedDays: true, cachedSyncedAt: true },
  })
  const mpReleased = mp?.cachedReleasedTotal ?? 0
  console.log(`\n[MP] liberado total lifetime cache: R$ ${mpReleased.toFixed(2)}`)
  console.log(`     sync: ${mp?.cachedSyncedAt?.toISOString() || "nunca"}`)

  // CMV lifetime — paid + pending (mesma fonte do DRE/Reposição)
  const receivablesPaid = await prisma.bill.findMany({
    where: { tenantId, type: "receivable", category: "venda", status: "paid" },
    select: { amount: true, productCost: true },
  })
  const receivablesAll = await prisma.bill.findMany({
    where: {
      tenantId,
      type: "receivable",
      category: "venda",
      NOT: { status: "cancelled" },
    },
    select: { amount: true, productCost: true, status: true },
  })
  const cmvPaid = receivablesPaid.reduce((s, b) => s + (b.productCost ?? 0), 0)
  const cmv = receivablesAll.reduce((s, b) => s + (b.productCost ?? 0), 0)
  console.log(`\n[CMV lifetime - só paid]      R$ ${cmvPaid.toFixed(2)} (${receivablesPaid.length} bills)`)
  console.log(`[CMV lifetime - paid+pending] R$ ${cmv.toFixed(2)} (${receivablesAll.length} bills)`)

  // CMV liberado (só vendas paid)
  const cmvLiberado = receivablesPaid.reduce((s, b) => s + (b.productCost ?? 0), 0)
  const lucroLiberado = mpReleased - cmvLiberado
  const proLaboreNovo = lucroLiberado - despesasTotal - aporteTotal

  console.log(`\n[FÓRMULA NOVA — lucro liberado − despesas]`)
  console.log(`  MP liberado lifetime:     R$ ${mpReleased.toFixed(2)}`)
  console.log(`  − CMV liberado (paid):    R$ ${cmvLiberado.toFixed(2)}`)
  console.log(`  = Lucro liberado:         R$ ${lucroLiberado.toFixed(2)}`)
  console.log(`  − Despesas pagas:         R$ ${despesasTotal.toFixed(2)}`)
  console.log(`  − Saídas sócio:           R$ ${aporteTotal.toFixed(2)}`)
  console.log(`  = Pró-labore (novo):      R$ ${proLaboreNovo.toFixed(2)}`)
  console.log(`\n  Reposição pendente (= CMV total − repo paga): R$ ${(cmv - reposicaoTotal).toFixed(2)}`)
  console.log(`\n[Comparação — fórmula antiga (caixa puro)]`)
  const caixa = mpReleased - Math.max(cmv, reposicaoTotal) - despesasTotal - aporteTotal
  console.log(`  Caixa = MP − max(CMV, repo) − despesas: R$ ${caixa.toFixed(2)}`)
}

main().finally(() => prisma.$disconnect())
