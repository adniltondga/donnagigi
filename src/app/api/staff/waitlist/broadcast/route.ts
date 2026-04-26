import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { AuthError, authErrorResponse, requireStaff } from "@/lib/auth"
import { sendWaitlistOpenedEmail } from "@/lib/waitlist-email"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * POST /api/staff/waitlist/broadcast — dispara o email "estamos no ar"
 * pra todos da WaitlistSignup com `notified=false`.
 *
 * Processa em batches sequenciais com delay pra não estourar rate limit
 * do Resend. Marca cada signup como `notified=true` à medida que envia.
 *
 * Body opcional: { dryRun?: boolean } — quando true, conta sem enviar.
 */
export async function POST(req: NextRequest) {
  try {
    await requireStaff()
    const body = await req.json().catch(() => ({}))
    const dryRun = body?.dryRun === true

    const pending = await prisma.waitlistSignup.findMany({
      where: { notified: false },
      orderBy: { createdAt: "asc" },
    })

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, would_send: pending.length })
    }

    let sent = 0
    let failed = 0
    const errors: Array<{ email: string; error: string }> = []

    // 1 email por vez com pequena pausa — Resend free tier ~10/s.
    for (const s of pending) {
      try {
        await sendWaitlistOpenedEmail(s.email)
        await prisma.waitlistSignup.update({
          where: { id: s.id },
          data: { notified: true },
        })
        sent++
      } catch (e) {
        failed++
        errors.push({
          email: s.email,
          error: e instanceof Error ? e.message : "erro desconhecido",
        })
      }
      // ~150ms entre envios mantém ~6/s
      await new Promise((r) => setTimeout(r, 150))
    }

    return NextResponse.json({
      ok: true,
      total: pending.length,
      sent,
      failed,
      errors: errors.slice(0, 20), // não enche o JSON com 1000 erros
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[staff/waitlist/broadcast]", err)
    return NextResponse.json({ error: "Erro no broadcast" }, { status: 500 })
  }
}
