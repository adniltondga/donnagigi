import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"
import { syncAndCacheMP } from "@/lib/mp"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * GET /api/mp/snapshot  → lê o cache salvo (resposta instantânea).
 * POST /api/mp/snapshot → bate na API do MP, atualiza o cache e retorna os
 *                        valores recém-sincronizados. Usado pelo botão
 *                        "Atualizar" e pode ser chamado por cron futuro.
 */

interface SnapshotResponse {
  configured: boolean
  unavailableBalance: number
  pendingCount: number
  releasedTotal: number
  releasedCount: number
  disputedTotal: number
  disputedCount: number
  pendingDays: unknown
  releasedDays: unknown
  disputedPayments: unknown
  cachedSyncedAt: string | null
  error?: string
}

export async function GET() {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const integration = await prisma.mPIntegration.findUnique({
      where: { tenantId },
      select: {
        cachedUnavailableBalance: true,
        cachedPendingCount: true,
        cachedReleasedTotal: true,
        cachedReleasedCount: true,
        cachedDisputedTotal: true,
        cachedDisputedCount: true,
        cachedPendingDays: true,
        cachedReleasedDays: true,
        cachedDisputedPayments: true,
        cachedSyncedAt: true,
      },
    })

    if (!integration) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const res: SnapshotResponse = {
      configured: true,
      unavailableBalance: integration.cachedUnavailableBalance ?? 0,
      pendingCount: integration.cachedPendingCount ?? 0,
      releasedTotal: integration.cachedReleasedTotal ?? 0,
      releasedCount: integration.cachedReleasedCount ?? 0,
      disputedTotal: integration.cachedDisputedTotal ?? 0,
      disputedCount: integration.cachedDisputedCount ?? 0,
      pendingDays: integration.cachedPendingDays ?? [],
      releasedDays: integration.cachedReleasedDays ?? [],
      disputedPayments: integration.cachedDisputedPayments ?? [],
      cachedSyncedAt: integration.cachedSyncedAt ? integration.cachedSyncedAt.toISOString() : null,
    }
    return NextResponse.json(res)
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[mp/snapshot GET]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function POST() {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    try {
      await syncAndCacheMP(tenantId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao sincronizar MP"
      return NextResponse.json({ configured: true, error: msg }, { status: 502 })
    }

    // Retorna o snapshot atualizado direto do banco — cliente reusa.
    const integration = await prisma.mPIntegration.findUnique({
      where: { tenantId },
      select: {
        cachedUnavailableBalance: true,
        cachedPendingCount: true,
        cachedReleasedTotal: true,
        cachedReleasedCount: true,
        cachedDisputedTotal: true,
        cachedDisputedCount: true,
        cachedPendingDays: true,
        cachedReleasedDays: true,
        cachedDisputedPayments: true,
        cachedSyncedAt: true,
      },
    })
    if (!integration) return NextResponse.json({ configured: false }, { status: 200 })

    return NextResponse.json({
      configured: true,
      unavailableBalance: integration.cachedUnavailableBalance ?? 0,
      pendingCount: integration.cachedPendingCount ?? 0,
      releasedTotal: integration.cachedReleasedTotal ?? 0,
      releasedCount: integration.cachedReleasedCount ?? 0,
      disputedTotal: integration.cachedDisputedTotal ?? 0,
      disputedCount: integration.cachedDisputedCount ?? 0,
      pendingDays: integration.cachedPendingDays ?? [],
      releasedDays: integration.cachedReleasedDays ?? [],
      disputedPayments: integration.cachedDisputedPayments ?? [],
      cachedSyncedAt: integration.cachedSyncedAt ? integration.cachedSyncedAt.toISOString() : null,
    } satisfies SnapshotResponse)
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[mp/snapshot POST]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
