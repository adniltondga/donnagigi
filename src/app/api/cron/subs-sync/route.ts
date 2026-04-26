import { NextResponse } from "next/server"
import {
  syncExpiredTrials,
  expireOverdueSubscriptions,
  expireCanceledPastPeriod,
} from "@/lib/subscription"
import { checkSystemNotifications } from "@/lib/notifications"
import { sendTrialEndingEmails, sendTrialExpiredEmails } from "@/lib/dunning"
import { captureError } from "@/lib/sentry"

export const dynamic = "force-dynamic"

/**
 * Cron diário de billing — roda às 3h da manhã (vercel.json).
 *
 * Faz 4 coisas:
 *  1. TRIAL com trialEndsAt < now      → EXPIRED + FREE
 *  2. OVERDUE há 7+ dias               → EXPIRED + FREE
 *  3. CANCELED com period vencido      → EXPIRED + FREE
 *  4. Notificações de sistema (tokens ML expirando, etc)
 *
 * Protege com CRON_SECRET opcional: se a env estiver setada, exige
 * o mesmo valor no header `x-cron-secret`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided = request.headers.get("x-cron-secret")
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  try {
    // 1. Dispara emails T-3/T-1 ANTES de expirar (precisa do status TRIAL)
    const trialEnding = await sendTrialEndingEmails()

    // 2. Aplica expirações
    const [expiredTrials, expiredOverdue, expiredCanceled] = await Promise.all([
      syncExpiredTrials(),
      expireOverdueSubscriptions(7),
      expireCanceledPastPeriod(),
    ])

    // 3. Email de "trial expirou" pra quem acabou de expirar
    const trialExpired = await sendTrialExpiredEmails()

    // 4. Notificações in-app de sistema
    const systemNotifs = await checkSystemNotifications()

    return NextResponse.json({
      ok: true,
      expired: {
        trials: expiredTrials,
        overdue: expiredOverdue,
        canceled: expiredCanceled,
      },
      dunning: {
        trialEnding,
        trialExpired,
      },
      systemNotifs,
      ranAt: new Date().toISOString(),
    })
  } catch (error) {
    captureError(error, { operation: "cron-subs-sync" })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "erro" },
      { status: 500 },
    )
  }
}
