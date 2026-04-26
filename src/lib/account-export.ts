/**
 * Export LGPD — gera ZIP com snapshot dos dados do tenant.
 *
 * Atende o direito de portabilidade (LGPD Art. 18, V): titular pode
 * solicitar uma cópia dos seus dados em formato estruturado.
 *
 * Dados sensíveis MASCARADOS antes do export:
 *  - User.password (hash)
 *  - MLIntegration.accessToken / refreshToken
 *  - MPIntegration.accessToken / refreshToken
 *  - MLAppCredentials.clientSecret
 *  - MPAppCredentials.clientSecret
 *  - PushSubscription.p256dh / auth (keys do device)
 *
 * Tudo o resto vai como está no banco.
 */

import JSZip from "jszip"
import prisma from "./prisma"

const README = `# Export agLivre

Exportação dos seus dados em conformidade com LGPD (Art. 18, V — direito de portabilidade).

## Arquivos

- tenant.json            : seus dados de empresa/conta
- users.json             : usuários da equipe (sem senhas)
- subscription.json      : sua assinatura (incluindo histórico)
- invoices.json          : faturas
- products.json          : produtos cadastrados (com variações e imagens)
- bills.json             : contas a pagar/receber + vendas ML
- suppliers.json         : fornecedores
- bill_categories.json   : categorias de contas
- ml_costs.json          : custos do Mercado Livre (anúncio + variação)
- ml_integration.json    : metadata da integração ML (tokens omitidos)
- mp_integration.json    : metadata da integração MP (tokens omitidos)
- notifications.json     : notificações in-app (últimas 500)
- push_subscriptions.json : devices com push ativo (keys omitidas)
- financial_settings.json : config financeira

## Notas de segurança

Tokens OAuth e secrets foram removidos do export — eles não pertencem
a você (são credenciais do agLivre acessando ML/MP em seu nome).

Senhas estão omitidas (são hashes que não fazem sentido fora do
sistema).

Gerado em: ${new Date().toISOString()}
`

export async function generateAccountExport(tenantId: string): Promise<{
  filename: string
  buffer: Buffer
}> {
  const [
    tenant,
    users,
    subscription,
    products,
    bills,
    suppliers,
    billCategories,
    mlCosts,
    mlVariantCosts,
    mlIntegration,
    mpIntegration,
    notifications,
    pushSubscriptions,
    financialSettings,
  ] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.subscription.findUnique({
      where: { tenantId },
      include: { invoices: true },
    }),
    prisma.product.findMany({
      where: { tenantId },
      include: {
        variants: { include: { images: true } },
        images: true,
      },
    }),
    prisma.bill.findMany({
      where: { tenantId },
      include: { billCategory: true },
    }),
    prisma.supplier.findMany({ where: { tenantId } }),
    prisma.billCategory.findMany({ where: { tenantId } }),
    prisma.mLProductCost.findMany({ where: { tenantId } }),
    prisma.mLProductVariantCost.findMany({ where: { tenantId } }),
    prisma.mLIntegration.findFirst({
      where: { tenantId },
      select: {
        id: true,
        sellerID: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.mPIntegration.findUnique({
      where: { tenantId },
      select: {
        id: true,
        mpUserId: true,
        expiresAt: true,
        scope: true,
        cachedSyncedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.pushSubscription.findMany({
      where: { tenantId },
      select: {
        id: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
        // p256dh e auth omitidos
      },
    }),
    prisma.financialSettings.findUnique({ where: { tenantId } }),
  ])

  if (!tenant) {
    throw new Error("Tenant não encontrado")
  }

  const zip = new JSZip()

  zip.file("README.md", README)
  zip.file("tenant.json", JSON.stringify(tenant, null, 2))
  zip.file("users.json", JSON.stringify(users, null, 2))
  zip.file("subscription.json", JSON.stringify(subscription, null, 2))
  zip.file(
    "invoices.json",
    JSON.stringify(subscription?.invoices ?? [], null, 2),
  )
  zip.file("products.json", JSON.stringify(products, null, 2))
  zip.file("bills.json", JSON.stringify(bills, null, 2))
  zip.file("suppliers.json", JSON.stringify(suppliers, null, 2))
  zip.file("bill_categories.json", JSON.stringify(billCategories, null, 2))
  zip.file(
    "ml_costs.json",
    JSON.stringify({ listings: mlCosts, variants: mlVariantCosts }, null, 2),
  )
  zip.file("ml_integration.json", JSON.stringify(mlIntegration, null, 2))
  zip.file("mp_integration.json", JSON.stringify(mpIntegration, null, 2))
  zip.file("notifications.json", JSON.stringify(notifications, null, 2))
  zip.file(
    "push_subscriptions.json",
    JSON.stringify(pushSubscriptions, null, 2),
  )
  zip.file(
    "financial_settings.json",
    JSON.stringify(financialSettings, null, 2),
  )

  const buffer = await zip.generateAsync({ type: "nodebuffer" })
  const date = new Date().toISOString().slice(0, 10)
  const filename = `aglivre-export-${tenant.slug}-${date}.zip`

  return { filename, buffer }
}
