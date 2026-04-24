import { NextResponse } from "next/server"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { fetchMPPendingPayments, getMPIntegrationForTenant } from "@/lib/mp"

export const dynamic = "force-dynamic"

/**
 * GET /api/mp/pending-payments
 * Lista pagamentos do MP com money_release_date futuro, agrupados por
 * dia (YYYY-MM-DD em horário local BR/São Paulo).
 */
export async function GET() {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const integration = await getMPIntegrationForTenant(tenantId)
    if (!integration) {
      return NextResponse.json(
        { configured: false, error: "Mercado Pago não conectado nesse tenant." },
        { status: 400 }
      )
    }

    try {
      const payments = await fetchMPPendingPayments({
        accessToken: integration.accessToken,
      })

      // Agrupa por dia no fuso BR. Usa pt-BR toLocaleString com timeZone.
      const byDay = new Map<
        string,
        {
          date: string
          total: number
          count: number
          payments: typeof payments
        }
      >()
      for (const p of payments) {
        const d = new Date(p.releaseDate)
        const dayKey = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) // YYYY-MM-DD
        const slot = byDay.get(dayKey) || { date: dayKey, total: 0, count: 0, payments: [] }
        slot.total += p.netAmount
        slot.count += 1
        slot.payments.push(p)
        byDay.set(dayKey, slot)
      }

      const days = Array.from(byDay.values())
        .map((d) => ({
          ...d,
          total: Math.round(d.total * 100) / 100,
          payments: d.payments.sort(
            (a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
          ),
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      const grandTotal = Math.round(payments.reduce((s, p) => s + p.netAmount, 0) * 100) / 100

      return NextResponse.json({
        configured: true,
        total: grandTotal,
        count: payments.length,
        days,
        lastUpdated: new Date().toISOString(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao consultar MP"
      return NextResponse.json({ configured: true, error: msg }, { status: 502 })
    }
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[mp/pending-payments]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
