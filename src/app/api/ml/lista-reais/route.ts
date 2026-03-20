import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

/**
 * PARTE 4D: Listar produtos REAIS do Mercado Livre
 * GET /api/ml/lista-reais?offset=0&limit=25
 * 
 * Após fazer login, lista seus produtos vendidos no ML
 * com mesmo formato que os testes
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const offset = parseInt(searchParams.get("offset") || "0")
    const limit = parseInt(searchParams.get("limit") || "25")

    console.log(`📦 Buscando produtos do ML (offset=${offset}, limit=${limit})`)

    // 1️⃣ Buscar integração ML
    const mlIntegration = await prisma.mLIntegration.findFirst()

    if (!mlIntegration) {
      return NextResponse.json({
        erro: "Não autenticado",
        mensagem: "Faça login primeiro em /api/ml/oauth/login",
        link_login: "GET /api/ml/oauth/login"
      }, { status: 401 })
    }

    // 2️⃣ Validar token
    const now = new Date()
    if (now > mlIntegration.expiresAt) {
      return NextResponse.json({
        erro: "Token expirado",
        mensagem: "Faça login novamente",
        motivo: `Expirado em ${mlIntegration.expiresAt.toISOString()}`
      }, { status: 401 })
    }

    // 3️⃣ Buscar listings do seller no ML
    const mlUrl = `https://api.mercadolibre.com/users/${mlIntegration.sellerID}/listings?offset=${offset}&limit=${limit}`

    console.log("📡 Chamando API ML:", mlUrl)

    const mlResponse = await fetch(mlUrl, {
      headers: {
        "Authorization": `Bearer ${mlIntegration.accessToken}`,
        "Content-Type": "application/json"
      }
    })

    if (!mlResponse.ok) {
      const error = await mlResponse.text()
      console.error("❌ Erro da API ML:", mlResponse.status, error)

      return NextResponse.json({
        erro: "Erro ao buscar produtos do ML",
        statusCode: mlResponse.status,
        detalhes: error
      }, { status: mlResponse.status })
    }

    const listings = await mlResponse.json()

    console.log(`✅ ${listings.length} listings encontrados no ML`)

    // 4️⃣ Para cada listing, buscar detalhes completos (com variações)
    const produtosCompletos = await Promise.all(
      listings.map(async (listing: any) => {
        try {
          const detailResponse = await fetch(
            `https://api.mercadolibre.com/items/${listing.id}`,
            {
              headers: {
                "Authorization": `Bearer ${mlIntegration.accessToken}`,
                "Content-Type": "application/json"
              }
            }
          )

          if (!detailResponse.ok) {
            return {
              id: listing.id,
              title: listing.title || "Sem título",
              price: 0,
              available_quantity: 0,
              variations: []
            }
          }

          const detail = await detailResponse.json()

          return {
            id: detail.id,
            title: detail.title,
            price: detail.price,
            available_quantity: detail.available_quantity,
            variations: detail.variations || []
          }
        } catch (e) {
          console.error(`❌ Erro fetchando ${listing.id}:`, e)
          return {
            id: listing.id,
            title: listing.title,
            price: 0,
            available_quantity: 0,
            variations: []
          }
        }
      })
    )

    // 5️⃣ Retornar com mesmo formato dos testes
    return NextResponse.json({
      autenticado: true,
      seller_id: mlIntegration.sellerID,
      token_expira_em: mlIntegration.expiresAt,
      
      pagination: {
        offset,
        limit,
        total: listings.length,
        has_more: listings.length === limit
      },

      produtos: produtosCompletos,

      resumo: {
        total_listados: produtosCompletos.length,
        com_variações: produtosCompletos.filter(p => p.variations?.length > 0).length,
        sem_variações: produtosCompletos.filter(p => !p.variations || p.variations.length === 0).length,
        total_estoque: produtosCompletos.reduce((sum, p) => sum + p.available_quantity, 0),
        valor_total: produtosCompletos.reduce((sum, p) => sum + p.price * p.available_quantity, 0)
      },

      instrucoes: [
        "✅ Dados reais do seu Mercado Livre!",
        "📦 Pronto para importar com POST /api/ml/import-batch",
        "💾 Use 'produtos' como array de input",
        "🔄 Dados sincronizados em tempo real"
      ]
    })
  } catch (error) {
    console.error("❌ Erro geral:", error)
    return NextResponse.json({
      erro: "Erro ao listar produtos",
      mensagem: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 })
  }
}
