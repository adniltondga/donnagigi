import prisma from "@/lib/prisma"
import { sendExpoPushToTenant } from "@/lib/expo-push"

export type NotificationType = "sale" | "refund" | "mp_release" | "system"

export interface CreateNotificationInput {
  tenantId: string
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
}

/**
 * Cria uma notificação in-app. Non-blocking por design: callers devem
 * ignorar o erro pra não quebrar o fluxo principal (ex: webhook).
 *
 * Após salvar, dispara push pro app mobile (Expo Push) em fire-and-forget.
 * Web Push (VAPID) é disparado pelo caller original quando necessário —
 * não fazemos aqui pra não quebrar callers existentes.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    })

    void sendExpoPushToTenant(input.tenantId, {
      title: input.title,
      body: input.body ?? undefined,
      data: { type: input.type, link: input.link ?? undefined },
    }).catch(() => {})
  } catch (err) {
    console.error("[notifications] create falhou:", err)
  }
}

export async function listRecent(tenantId: string, limit = 20) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({
      where: { tenantId, read: false },
    }),
  ])
  return { items, unreadCount }
}

export async function markOneRead(tenantId: string, id: string) {
  await prisma.notification.updateMany({
    where: { id, tenantId },
    data: { read: true },
  })
}

export async function markAllRead(tenantId: string) {
  await prisma.notification.updateMany({
    where: { tenantId, read: false },
    data: { read: true },
  })
}

/**
 * Cria uma notificação apenas se não existir outra idêntica recente.
 * Dedup por (tenantId, type, title) nas últimas 23h — evita spam diário
 * quando o mesmo cron detecta a mesma condição.
 */
export async function createNotificationIfNew(
  input: CreateNotificationInput,
  dedupHours = 23,
): Promise<void> {
  try {
    const since = new Date(Date.now() - dedupHours * 60 * 60 * 1000)
    const existing = await prisma.notification.findFirst({
      where: {
        tenantId: input.tenantId,
        type: input.type,
        title: input.title,
        createdAt: { gte: since },
      },
      select: { id: true },
    })
    if (existing) return
    await createNotification(input)
  } catch (err) {
    console.error("[notifications] createIfNew falhou:", err)
  }
}

/**
 * Checa condições de sistema (tokens expirando, assinaturas vencendo) e
 * cria notificações type=system per-tenant com dedup 23h. Pensado pra
 * rodar dentro do cron diário.
 */
export async function checkSystemNotifications(): Promise<{
  tokenExpiring: number
  trialExpiring: number
  trialExpired: number
}> {
  const counters = { tokenExpiring: 0, trialExpiring: 0, trialExpired: 0 }
  const now = new Date()
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const in2d = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const expiringTokens = await prisma.mLIntegration.findMany({
    where: { expiresAt: { gte: now, lte: in48h } },
    select: { tenantId: true, expiresAt: true },
  })
  for (const t of expiringTokens) {
    const hoursLeft = Math.max(1, Math.round((t.expiresAt.getTime() - now.getTime()) / 3_600_000))
    await createNotificationIfNew({
      tenantId: t.tenantId,
      type: "system",
      title: `Token do Mercado Livre expira em ${hoursLeft}h`,
      body: "Reconecte em Configurações > Mercado Livre pra evitar interrupção da sincronização.",
      link: "/admin/configuracoes?tab=ml",
    })
    counters.tokenExpiring++
  }

  const expiringTrials = await prisma.subscription.findMany({
    where: {
      status: "TRIAL",
      trialEndsAt: { gte: now, lte: in2d },
    },
    select: { tenantId: true, trialEndsAt: true },
  })
  for (const s of expiringTrials) {
    const daysLeft = Math.max(
      1,
      Math.ceil(((s.trialEndsAt?.getTime() ?? 0) - now.getTime()) / (24 * 60 * 60 * 1000)),
    )
    await createNotificationIfNew({
      tenantId: s.tenantId,
      type: "system",
      title: `Período de teste termina em ${daysLeft} dia(s)`,
      body: "Escolha um plano pra continuar usando o agLivre sem interrupção.",
      link: "/admin/billing/planos",
    })
    counters.trialExpiring++
  }

  const justExpired = await prisma.subscription.findMany({
    where: {
      status: "EXPIRED",
      trialEndsAt: { gte: last24h, lte: now },
    },
    select: { tenantId: true },
  })
  for (const s of justExpired) {
    await createNotificationIfNew({
      tenantId: s.tenantId,
      type: "system",
      title: "Seu teste gratuito expirou",
      body: "Assine um plano pra manter acesso aos seus dados.",
      link: "/admin/billing/planos",
    })
    counters.trialExpired++
  }

  return counters
}
