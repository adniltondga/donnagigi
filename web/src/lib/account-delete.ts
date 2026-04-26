/**
 * Soft + hard delete de conta (LGPD direito ao esquecimento).
 *
 * Fluxo:
 *  1. softDeleteAccount: marca tenant.deletedAt, cancela ASAAS,
 *     persiste audit log, dispara email "conta excluída".
 *  2. Tenant fica em estado "soft-deleted" por 30 dias — o middleware
 *     bloqueia acesso ao admin nesse período.
 *  3. restoreAccount: zera deletedAt + atualiza log + email.
 *  4. purgeOldDeletedAccounts (cron diário): tenants com deletedAt
 *     há +30d são deletados via prisma.tenant.delete (cascade).
 *     O log fica preservado pra fins de auditoria/LGPD.
 */

import prisma from "./prisma"
import { asaasCancelSubscription } from "./asaas"
import {
  sendEmail,
  accountDeletedTemplate,
  accountRestoredTemplate,
} from "./email"
import { captureError } from "./sentry"

const SITE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://aglivre.dgadigital.com.br"

const HARD_DELETE_DAYS = 30

export async function softDeleteAccount(params: {
  tenantId: string
  userId: string
  reason?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<{ ok: true; logId: string }> {
  const { tenantId } = params

  // Snapshot de dados antes de marcar deletedAt
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true },
  })
  if (!tenant) {
    throw new Error("Tenant não encontrado")
  }

  const owner = await prisma.user.findFirst({
    where: { tenantId, role: "OWNER" },
    select: { name: true, email: true },
  })

  // Cancela subscription ASAAS (best-effort — não bloqueia o delete)
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { asaasSubscriptionId: true },
  })
  if (sub?.asaasSubscriptionId) {
    try {
      await asaasCancelSubscription(sub.asaasSubscriptionId)
    } catch (err) {
      captureError(err, {
        tenantId,
        operation: "account-delete-asaas-cancel",
      })
    }
  }

  const now = new Date()
  const scheduledHardDeleteAt = new Date(
    now.getTime() + HARD_DELETE_DAYS * 24 * 60 * 60 * 1000,
  )

  // Marca soft delete + cria log em transação
  const log = await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenantId },
      data: { deletedAt: now },
    })
    return tx.accountDeletionLog.create({
      data: {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        ownerEmail: owner?.email ?? "",
        ownerName: owner?.name ?? "",
        reason: params.reason || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        softDeletedAt: now,
        scheduledHardDeleteAt,
      },
    })
  })

  // Email de confirmação (best-effort)
  if (owner?.email) {
    try {
      await sendEmail({
        to: owner.email,
        ...accountDeletedTemplate({
          tenantName: tenant.name,
          hardDeleteDate: scheduledHardDeleteAt,
          restoreUrl: `${SITE_URL}/conta-excluida`,
        }),
      })
    } catch (err) {
      captureError(err, {
        tenantId,
        operation: "account-delete-email",
      })
    }
  }

  return { ok: true, logId: log.id }
}

export async function restoreAccount(params: {
  tenantId: string
}): Promise<{ ok: true }> {
  const { tenantId } = params
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, deletedAt: true },
  })
  if (!tenant) throw new Error("Tenant não encontrado")
  if (!tenant.deletedAt) throw new Error("Conta não está excluída")

  const owner = await prisma.user.findFirst({
    where: { tenantId, role: "OWNER" },
    select: { email: true },
  })

  const now = new Date()
  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenantId },
      data: { deletedAt: null },
    }),
    prisma.accountDeletionLog.updateMany({
      where: { tenantId, restoredAt: null, hardDeletedAt: null },
      data: { restoredAt: now },
    }),
  ])

  if (owner?.email) {
    try {
      await sendEmail({
        to: owner.email,
        ...accountRestoredTemplate({
          tenantName: tenant.name,
          loginUrl: `${SITE_URL}/admin/login`,
        }),
      })
    } catch (err) {
      captureError(err, {
        tenantId,
        operation: "account-restore-email",
      })
    }
  }

  return { ok: true }
}

export async function purgeOldDeletedAccounts(): Promise<{
  purged: number
  failed: number
}> {
  const now = new Date()
  const due = await prisma.tenant.findMany({
    where: {
      deletedAt: { not: null, lt: new Date(now.getTime() - HARD_DELETE_DAYS * 86_400_000) },
    },
    select: { id: true, slug: true, name: true },
  })

  let purged = 0
  let failed = 0

  for (const t of due) {
    try {
      await prisma.$transaction([
        prisma.accountDeletionLog.updateMany({
          where: {
            tenantId: t.id,
            hardDeletedAt: null,
            restoredAt: null,
          },
          data: { hardDeletedAt: now },
        }),
        prisma.tenant.delete({ where: { id: t.id } }),
      ])
      purged++
    } catch (err) {
      captureError(err, {
        tenantId: t.id,
        operation: "account-purge",
      })
      failed++
    }
  }

  return { purged, failed }
}
