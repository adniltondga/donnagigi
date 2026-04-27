import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/api-log-retention
 *
 * Apaga registros de ApiCallLog mais velhos que 30 dias. Roda 1×/dia
 * via Vercel cron (vercel.json).
 *
 * Idempotente — chamadas extras só voltam 0 deletados.
 */
export async function GET() {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)

    const deleted = await prisma.apiCallLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })

    return NextResponse.json({ ok: true, deleted: deleted.count, cutoff: cutoff.toISOString() })
  } catch (err) {
    console.error("[cron/api-log-retention]", err)
    return NextResponse.json({ erro: "Falha" }, { status: 500 })
  }
}
