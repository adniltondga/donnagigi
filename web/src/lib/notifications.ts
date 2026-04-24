import prisma from "@/lib/prisma"

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
