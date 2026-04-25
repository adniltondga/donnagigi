import webpush from "web-push"
import prisma from "./prisma"
import { captureError } from "./sentry"

/**
 * Web Push API helper. Exige VAPID keys configuradas no .env:
 *  - NEXT_PUBLIC_VAPID_PUBLIC_KEY (exposta no client pra subscribe)
 *  - VAPID_PRIVATE_KEY (server-only, assina os pushes)
 *  - VAPID_SUBJECT (mailto: ou URL — exigido pela spec)
 *
 * Em dev sem essas vars, sendPushToTenant vira no-op silencioso.
 */

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivate = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT

let initialized = false

function ensureInitialized(): boolean {
  if (initialized) return true
  if (!vapidPublic || !vapidPrivate || !vapidSubject) return false
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
  initialized = true
  return true
}

export interface PushPayload {
  title: string
  body?: string
  url?: string
}

/**
 * Envia push pra todas as subscriptions ativas do tenant. Falhas
 * de delivery não quebram nada — subs expiradas (410/404) são
 * limpas automaticamente.
 */
export async function sendPushToTenant(
  tenantId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!ensureInitialized()) return { sent: 0, failed: 0 }

  const subs = await prisma.pushSubscription.findMany({
    where: { tenantId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })

  if (subs.length === 0) return { sent: 0, failed: 0 }

  const body = JSON.stringify(payload)
  let sent = 0
  let failed = 0
  const expiredIds: string[] = []

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        )
        sent++
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : null
        if (status === 410 || status === 404) {
          // Subscription expirou ou foi revogada
          expiredIds.push(sub.id)
        } else {
          failed++
          captureError(err, {
            tenantId,
            operation: "push-send",
            extra: { endpoint: sub.endpoint.slice(0, 60) },
          })
        }
      }
    }),
  )

  if (expiredIds.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: expiredIds } } })
      .catch(() => {})
  }

  return { sent, failed }
}
