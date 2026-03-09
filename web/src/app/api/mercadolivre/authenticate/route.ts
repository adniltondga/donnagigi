import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

/**
 * POST /api/mercadolivre/authenticate
 * Autentica com Mercado Livre usando um access token
 * 
 * Body:
 * {
 *   "accessToken": "YOUR_ML_ACCESS_TOKEN"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accessToken } = body

    if (!accessToken) {
      return NextResponse.json(
        { error: "accessToken é obrigatório" },
        { status: 400 }
      )
    }

    // Validar token fazendo uma requisição ao Mercado Livre
    console.log("[ML Auth] Validando token com Mercado Livre...")

    const meResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!meResponse.ok) {
      const error = await meResponse.json()
      console.error("[ML Auth] Erro ao validar token:", error)
      return NextResponse.json(
        {
          error: "Token inválido ou expirado",
          details: error.message || "Erro ao validar com Mercado Livre",
        },
        { status: 401 }
      )
    }

    const userData = await meResponse.json()
    const sellerId = userData.id.toString()

    console.log(`[ML Auth] ✅ Token validado para vendedor: ${sellerId}`)

    // Deletar integração anterior se existir
    const existing = await prisma.mLIntegration.findFirst()
    if (existing) {
      console.log("[ML Auth] Removendo integração anterior...")
      await prisma.mLIntegration.delete({
        where: { id: existing.id },
      })
    }

    // Criar nova integração
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 ano (token não expira normalmente)

    const integration = await prisma.mLIntegration.create({
      data: {
        accessToken,
        refreshToken: null,
        sellerID: sellerId,
        expiresAt,
      },
    })

    console.log("[ML Auth] ✅ Integração salva no banco de dados")

    return NextResponse.json({
      success: true,
      message: "Autenticação bem-sucedida!",
      integration: {
        sellerID: integration.sellerID,
        email: userData.email,
        nickname: userData.nickname,
        expiresAt: integration.expiresAt,
      },
    })
  } catch (error) {
    console.error("[ML Auth] Erro:", error)
    return NextResponse.json(
      {
        error: "Erro ao autenticar",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}
