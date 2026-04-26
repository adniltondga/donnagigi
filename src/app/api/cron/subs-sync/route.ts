import { NextResponse } from "next/server"
import {
  syncExpiredTrials,
  expireOverdueSubscriptions,
  expireCanceledPastPeriod,
} from "@/lib/subscription"
import { checkSystemNotifications } from "@/lib/notifications"
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
    const [expiredTrials, expiredOverdue, expiredCanceled, systemNotifs] =
      await Promise.all([
        syncExpiredTrials(),
        expireOverdueSubscriptions(7),
        expireCanceledPastPeriod(),
        checkSystemNotifications(),
      ])

    return NextResponse.json({
      ok: true,
      expired: {
        trials: expiredTrials,
        overdue: expiredOverdue,
        canceled: expiredCanceled,
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
