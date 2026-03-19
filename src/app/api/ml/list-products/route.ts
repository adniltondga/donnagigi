import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

/**
 * PASSO 2: Buscar lista de produtos do Mercado Livre
 * GET /api/ml/list-products?offset=0&limit=25
 * 
 * Fluxo:
 * 1. Busca MLIntegration configurada
 * 2. Valida token (verifica se não expirou)
 * 3. Chama API /users/{USER_ID}/listings da ML
 * 4. Retorna lista de produtos com estrutura
 */

export async function GET(request: Request) {
  try {
    // Pegar parâmetros da query
    const { searchParams } = new URL(request.url)
    const offset = parseInt(searchParams.get("offset") || "0")
    const limit = parseInt(searchParams.get("limit") || "25")

    // 1️⃣ Buscar integração ML configurada
    const mlIntegration = await prisma.mLIntegration.findFirst()

    if (!mlIntegration) {
      return NextResponse.json({
        error: "MLIntegration não configurada",
        message: "Configure a integração antes de listar produtos",
        configurar_em: "/api/mercadolivre/integration"
      }, { status: 401 })
    }

    // 2️⃣ Validar token
    const now = new Date()
    if (now > mlIntegration.expiresAt) {
      return NextResponse.json({
        error: "Token expirado",
        message: "Faça login novamente para renovar o token",
        expiresAt: mlIntegration.expiresAt
      }, { status: 401 })
    }

    // 3️⃣ Chamar API do Mercado Livre
    const mlUrl = `https://api.mercadolibre.com/users/${mlIntegration.sellerID}/listings?offset=${offset}&limit=${limit}`
    
    console.log("📡 Chamando API ML:", mlUrl)

    const mlResponse = await fetch(mlUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${mlIntegration.accessToken}`,
        "Content-Type": "application/json"
      }
    })

    if (!mlResponse.ok) {
      const error = await mlResponse.text()
      console.error("❌ Erro da API ML:", error)
      
      return NextResponse.json({
        error: "Erro ao buscar produtos do ML",
        statusCode: mlResponse.status,
        details: error
      }, { status: mlResponse.status })
    }

    const listings = await mlResponse.json()

    // 4️⃣ Estruturar resposta
    return NextResponse.json({
      success: true,
      seller_id: mlIntegration.sellerID,
      pagination: {
        offset,
        limit,
        total: listings.length,
        has_more: listings.length === limit
      },
      listings: listings.map((listing: any) => ({
        id: listing.id,
        title: listing.title,
        status: listing.status, // "active", "paused", "closed", etc
        url: listing.permalink,
        created: listing.date_created,
        updated: listing.date_updated,
        // Será preenchido quando buscarmos detalhes completos
        details_available: false,
        message: "Use /api/ml/get-product/{listing_id} para buscar detalhes completos com variações"
      })),
      proximos_passos: [
        "1️⃣  Escolha um produto desta lista",
        "2️⃣  Chame GET /api/ml/get-product/{listing_id} para buscar detalhes",
        "3️⃣  Veja variações e estrutura completa",
        "4️⃣  Prepare para importar no sistema"
      ]
    })

  } catch (error) {
    console.error("Erro:", error)
    return NextResponse.json({
      error: "Erro ao listar produtos",
      message: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 })
  }
}
