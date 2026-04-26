import { NextResponse } from "next/server"
import { purgeOldDeletedAccounts } from "@/lib/account-delete"
import { captureError } from "@/lib/sentry"

export const dynamic = "force-dynamic"

/**
 * Cron diário: aplica hard delete em tenants com soft-delete há +30d.
 * Mantém o AccountDeletionLog (sem FK, fica preservado).
 *
 * Protege com CRON_SECRET (mesmo padrão do subs-sync).
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
    const result = await purgeOldDeletedAccounts()
    return NextResponse.json({
      ok: true,
      ...result,
      ranAt: new Date().toISOString(),
    })
  } catch (error) {
    captureError(error, { operation: "cron-account-purge" })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "erro" },
      { status: 500 },
    )
  }
}
