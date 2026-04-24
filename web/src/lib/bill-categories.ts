import prisma from "./prisma"

/**
 * Categorias padrão criadas no primeiro acesso de cada tenant.
 * Lista pensada pra um vendedor ML pequeno/médio (agLivre). Pode ser
 * customizada pelo tenant depois via /admin/financeiro aba Categorias.
 */
const DEFAULT_CATEGORIES: Array<{
  type: "payable" | "receivable"
  name: string
  subs: string[]
}> = [
  { type: "payable", name: "Impostos", subs: ["DAS MEI", "DAS", "ICMS", "Nota Fiscal"] },
  { type: "payable", name: "Fornecedores", subs: ["Mercadoria", "Embalagem", "Frete"] },
  { type: "payable", name: "Marketplace", subs: ["Taxa de venda", "Taxa de envio", "Impulso"] },
  { type: "payable", name: "Operacional", subs: ["Internet", "Energia", "Aluguel", "Software/SaaS"] },
  { type: "payable", name: "Pessoal", subs: ["Pró-labore", "Salário", "13º/Férias"] },
  // Aporte sócio = despesas que o sócio pagou do bolso pra loja. Saldo
  // vivo desse grupo é a "dívida" da loja com ele (vai sendo amortizada
  // quando a loja pagar de volta).
  { type: "payable", name: "Aporte sócio", subs: ["Mercadoria", "Embalagem", "Frete", "Outros", "Amortização"] },
  { type: "payable", name: "Outros", subs: ["Outros"] },
  { type: "receivable", name: "Vendas", subs: ["Venda ML", "Venda Shopee", "Venda outros"] },
  { type: "receivable", name: "Outros", subs: ["Outros"] },
]

/**
 * Cria as categorias padrão pro tenant se ele ainda não tem nenhuma.
 * Idempotente: roda só se BillCategory.count() = 0 no tenant.
 */
export async function ensureDefaultCategoriesForTenant(tenantId: string) {
  const existing = await prisma.billCategory.count({ where: { tenantId } })
  if (existing > 0) return

  for (const cat of DEFAULT_CATEGORIES) {
    const parent = await prisma.billCategory.create({
      data: { name: cat.name, type: cat.type, tenantId, parentId: null },
    })
    for (const sub of cat.subs) {
      await prisma.billCategory.create({
        data: { name: sub, type: cat.type, tenantId, parentId: parent.id },
      })
    }
  }
}
