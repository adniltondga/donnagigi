import { NextResponse } from "next/server"
import { syncExpiredTrials } from "@/lib/subscription"

export const dynamic = "force-dynamic"

/**
 * Cron diário que flipa TRIAL → EXPIRED quando trialEndsAt passou.
 * Pode ser invocado por Vercel Cron, QStash, ou manualmente.
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

  return NextResponse.json({
    ok: true,
    expiredTrials,
    ranAt: new Date().toISOString(),
  })
}
