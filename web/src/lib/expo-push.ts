import prisma from "./prisma"
import { captureError } from "./sentry"

/**
 * Expo Push Service helper. Envia notificações pro app mobile
 * (aglivre-app) via https://exp.host/--/api/v2/push/send.
 *
 * Separado de `push.ts` (Web Push/VAPID) porque o canal e o shape
 * do token são diferentes: aqui o token é uma string opaca no
 * formato `ExponentPushToken[xxx]` ou `ExpoPushToken[xxx]`.
 *
 * Não requer credenciais — Expo Push é gratuito e usa só o token
 * registrado pelo device. Limite de 100 mensagens por request.
 *
 * Em ambiente sem fetch ou com erro de rede, vira no-op silencioso —
 * push não deve quebrar o fluxo principal (ex: webhook ML).
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

export interface ExpoPushPayload {
  title: string
  body?: string
  data?: Record<string, unknown>
}

interface ExpoPushTicket {
  status: "ok" | "error"
  id?: string
  message?: string
  details?: { error?: string }
}

interface ExpoPushResponse {
  data?: ExpoPushTicket[] | ExpoPushTicket
  errors?: { code: string; message: string }[]
}

function isValidExpoToken(token: string): boolean {
  return (
    token.startsWith("ExponentPushToken[") ||
    token.startsWith("ExpoPushToken[")
  )
}

export async function sendExpoPushToTenant(
  tenantId: string,
  payload: ExpoPushPayload,
): Promise<{ sent: number; failed: number }> {
  const subs = await prisma.expoPushSubscription.findMany({
    where: { tenantId },
    select: { id: true, token: true },
  })

  if (subs.length === 0) return { sent: 0, failed: 0 }

  // Filtra tokens em formato inválido (defensivo — não deveria entrar
  // no banco, mas se entrou, evita 400 do Expo Push Service).
  const valid = subs.filter((s) => isValidExpoToken(s.token))
  const invalidIds = subs.filter((s) => !isValidExpoToken(s.token)).map((s) => s.id)
  if (invalidIds.length > 0) {
    await prisma.expoPushSubscription
      .deleteMany({ where: { id: { in: invalidIds } } })
      .catch(() => {})
  }
  if (valid.length === 0) return { sent: 0, failed: 0 }

  // Expo aceita batches de até 100 messages por request.
  const chunks: typeof valid[] = []
  for (let i = 0; i < valid.length; i += 100) {
    chunks.push(valid.slice(i, i + 100))
  }

  let sent = 0
  let failed = 0
  const expiredIds: string[] = []

  await Promise.all(
    chunks.map(async (chunk) => {
      const messages = chunk.map((s) => ({
        to: s.token,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: "default" as const,
        priority: "high" as const,
      }))

      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messages),
        })

        const json = (await res.json()) as ExpoPushResponse

        if (!res.ok || json.errors?.length) {
          failed += chunk.length
          captureError(new Error("Expo push request failed"), {
            tenantId,
            operation: "expo-push-send",
            extra: { status: res.status, errors: json.errors },
          })
          return
        }

        const tickets = Array.isArray(json.data)
          ? json.data
          : json.data
            ? [json.data]
            : []

        tickets.forEach((ticket, i) => {
          if (ticket.status === "ok") {
            sent++
            return
          }
          const err = ticket.details?.error
          // DeviceNotRegistered → token inválido, remove do banco
          if (err === "DeviceNotRegistered") {
            const sub = chunk[i]
            if (sub) expiredIds.push(sub.id)
          } else {
            failed++
          }
        })
      } catch (err) {
        failed += chunk.length
        captureError(err, {
          tenantId,
          operation: "expo-push-send",
        })
      }
    }),
  )

  if (expiredIds.length > 0) {
    await prisma.expoPushSubscription
      .deleteMany({ where: { id: { in: expiredIds } } })
      .catch(() => {})
  }

  return { sent, failed }
}
