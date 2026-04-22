import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

// GET - Verificar status da integração
export async function GET() {
  try {
    const mlIntegration = await prisma.mLIntegration.findFirst()

    if (!mlIntegration) {
      return NextResponse.json({
        configured: false,
        message: "Integração não configurada",
      })
    }

    const isExpired = new Date() > mlIntegration.expiresAt

    return NextResponse.json({
      configured: true,
      sellerID: mlIntegration.sellerID,
      isExpired,
      expiresAt: mlIntegration.expiresAt,
    })
  } catch (error) {
    console.error("Erro ao verificar integração:", error)
    return NextResponse.json(
      { error: "Erro ao verificar integração" },
      { status: 500 }
    )
  }
}

// POST - Configurar/atualizar integração
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accessToken, refreshToken, sellerID, expiresAt } = body

    if (!accessToken || !sellerID) {
      return NextResponse.json(
        { error: "accessToken e sellerID são obrigatórios" },
        { status: 400 }
      )
    }

    // Deletar integração anterior se existir
    const existing = await prisma.mLIntegration.findFirst()
    if (existing) {
      await prisma.mLIntegration.delete({
        where: { id: existing.id },
      })
    }

    // Criar nova integração
    const { getDefaultTenantId } = await import("@/lib/tenant")
    const tenantId = await getDefaultTenantId()
    const integration = await prisma.mLIntegration.create({
      data: {
        accessToken,
        refreshToken,
        sellerID,
        expiresAt: new Date(expiresAt || new Date().getTime() + 6 * 60 * 60 * 1000), // 6 horas por padrão
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
    console.error("Erro ao configurar integração:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    )
  }
}

// DELETE - Desconectar do Mercado Livre
export async function DELETE() {
  try {
    const mlIntegration = await prisma.mLIntegration.findFirst()

    if (!mlIntegration) {
      return NextResponse.json(
        { error: "Nenhuma integração configurada" },
        { status: 404 }
      )
    }

    // Deletar todos os produtos sincronizados também
    await prisma.mLProduct.deleteMany({
      where: {
        integrationId: mlIntegration.id,
      },
    })

    // Deletar integração
    await prisma.mLIntegration.delete({
      where: { id: mlIntegration.id },
    })

    return NextResponse.json({
      success: true,
      message: "Integração removida com sucesso",
    })
  } catch (error) {
    console.error("Erro ao remover integração:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    )
  }
}
