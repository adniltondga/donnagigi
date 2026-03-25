import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

/**
 * DELETE /api/mercadolivre/reset
 * Remove a integração e força o usuário a reconectar com os scopes corretos
 */
export async function DELETE() {
  try {
    const integration = await prisma.mLIntegration.findFirst()

    if (!integration) {
      return NextResponse.json({
        success: true,
        message: "Nenhuma integração para resetar",
      })
    }

    // Deletar produtos sincronizados
    await prisma.mLProduct.deleteMany({
      where: {
        integrationId: integration.id,
      },
    })

    // Deletar integração
    await prisma.mLIntegration.delete({
      where: { id: integration.id },
    })

    console.log("[ML/RESET] Integração removida com sucesso")

    return NextResponse.json({
      success: true,
      message: "Integração resetada. Faça login novamente para obter as permissões corretas.",
      nextStep: "/api/ml/oauth/login",
    })
  } catch (error) {
    console.error("[ML/RESET] Erro ao resetar:", error)
    return NextResponse.json(
      {
        error: "Erro ao resetar integração",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}
