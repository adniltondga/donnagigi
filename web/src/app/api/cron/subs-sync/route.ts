import { NextResponse } from "next/server"
import { syncExpiredTrials } from "@/lib/subscription"
import { checkSystemNotifications } from "@/lib/notifications"

export const dynamic = "force-dynamic"

/**
 * Cron diário: flipa TRIAL → EXPIRED quando trialEndsAt passou e dispara
 * notificações de sistema (token ML expirando, trial acabando).
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

  const expiredTrials = await syncExpiredTrials()
  const systemNotifs = await checkSystemNotifications()

  return NextResponse.json({
    ok: true,
    expiredTrials,
    systemNotifs,
    ranAt: new Date().toISOString(),
  })
}
