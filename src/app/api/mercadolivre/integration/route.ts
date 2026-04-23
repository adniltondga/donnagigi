import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireRole } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * Endpoint legacy mantido por compat com a UI /admin/integracao.
 * Escopado ao tenant logado.
 */

export async function GET() {
  try {
    const tenantId = await getTenantIdOrDefault()
    const integration = await prisma.mLIntegration.findFirst({ where: { tenantId } })

    if (!integration) {
      return NextResponse.json({
        configured: false,
        message: "Integração não configurada",
      })
    }

    const isExpired = new Date() > integration.expiresAt

    return NextResponse.json({
      configured: true,
      sellerID: integration.sellerID,
      isExpired,
      expiresAt: integration.expiresAt,
    })
  } catch (error) {
    console.error("Erro ao verificar integração:", error)
    return NextResponse.json({ error: "Erro ao verificar integração" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['OWNER', 'ADMIN'])
    const body = await request.json()
    const { accessToken, refreshToken, sellerID, expiresAt } = body

    if (!accessToken || !sellerID) {
      return NextResponse.json(
        { error: "accessToken e sellerID são obrigatórios" },
        { status: 400 }
      )
    }

    const tenantId = await getTenantIdOrDefault()

    // Deletar integração do mesmo tenant (uma por tenant)
    await prisma.mLIntegration.deleteMany({ where: { tenantId } })

    const integration = await prisma.mLIntegration.create({
      data: {
        accessToken,
        refreshToken,
        sellerID,
        expiresAt: new Date(expiresAt || new Date().getTime() + 6 * 60 * 60 * 1000),
        tenantId,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Integração configurada com sucesso",
      integration: {
        sellerID: integration.sellerID,
        expiresAt: integration.expiresAt,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error)
    console.error("Erro ao configurar integração:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    await requireRole(['OWNER', 'ADMIN'])
    const tenantId = await getTenantIdOrDefault()
    const integration = await prisma.mLIntegration.findFirst({ where: { tenantId } })

    if (!integration) {
      return NextResponse.json({ error: "Nenhuma integração configurada" }, { status: 404 })
    }

    await prisma.mLProduct.deleteMany({ where: { integrationId: integration.id } })
    await prisma.mLIntegration.delete({ where: { id: integration.id } })

    return NextResponse.json({ success: true, message: "Integração removida com sucesso" })
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error)
    console.error("Erro ao remover integração:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    )
  }
}
