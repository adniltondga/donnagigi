import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * Status da integração ML do tenant atual. Consumido pelo dashboard.
 */
export async function GET() {
  try {
    const tenantId = await getTenantIdOrDefault()

    const integration = await prisma.mLIntegration.findFirst({
      where: { tenantId },
      select: { sellerID: true, expiresAt: true, updatedAt: true },
    })

    if (!integration) {
      return NextResponse.json({ connected: false })
    }

    const isExpired = integration.expiresAt < new Date()

    return NextResponse.json({
      connected: true,
      sellerID: integration.sellerID,
      expiresAt: integration.expiresAt,
      isExpired,
      updatedAt: integration.updatedAt,
    })
  } catch (error) {
    console.error("ml/status error:", error)
    return NextResponse.json({ error: "Falha ao consultar status" }, { status: 500 })
  }
}
