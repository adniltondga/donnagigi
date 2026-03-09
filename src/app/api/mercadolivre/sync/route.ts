import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { syncProductToML } from "@/lib/syncML"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

// POST - Sincronizar um produto para Mercado Livre
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId } = body

    if (!productId) {
      return NextResponse.json(
        { error: "productId é obrigatório" },
        { status: 400 }
      )
    }

    // Buscar token de integração
    const mlIntegration = await prisma.mLIntegration.findFirst()
    if (!mlIntegration) {
      return NextResponse.json(
        { error: "Integração com Mercado Livre não configurada" },
        { status: 400 }
      )
    }

    // Verificar se token não expirou
    if (new Date() > mlIntegration.expiresAt) {
      return NextResponse.json(
        { error: "Token de Mercado Livre expirado" },
        { status: 401 }
      )
    }

    const result = await syncProductToML(
      productId,
      mlIntegration.accessToken,
      mlIntegration.sellerID
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("Erro ao sincronizar produto:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    )
  }
}
