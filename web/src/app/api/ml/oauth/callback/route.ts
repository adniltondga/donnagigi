import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

/**
 * PARTE 4B: Callback do OAuth2 do Mercado Livre
 * GET /api/ml/oauth/callback?code=...&state=...
 * 
 * O ML redireciona aqui após o usuário autorizar
 * Trocamos o code por token e salvamos no banco
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const error = searchParams.get("error")

    // Verificar se houve erro de autorização
    if (error) {
      return NextResponse.json({
        erro: "Autorização negada",
        motivo: error,
        descricao: searchParams.get("error_description")
      })
    }

    if (!code) {
      return NextResponse.json({
        erro: "Código não fornecido pelo ML"
      }, { status: 400 })
    }

    console.log("📡 Recebido código do ML:", code.substring(0, 20) + "...")

    // 1️⃣ Trocar código por token
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const clientId = process.env.ML_CLIENT_ID
    const clientSecret = process.env.ML_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json({
        erro: "Credenciais ML não configuradas"
      }, { status: 500 })
    }

    const tokenUrl = "https://api.mercadolibre.com/oauth/token"

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: `${baseUrl}/api/ml/oauth/callback`
    })

    console.log("📡 Trocando código por token...")

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      body: tokenParams.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error("❌ Erro ao trocar código:", errorData)
      return NextResponse.json({
        erro: "Erro ao trocar código por token",
        detalhes: errorData
      }, { status: tokenResponse.status })
    }

    const tokenData = await tokenResponse.json()

    console.log("✅ Token recebido do ML")

    // 2️⃣ Buscar informações do usuário (seller ID)
    const userResponse = await fetch(
      "https://api.mercadolibre.com/users/me",
      {
        headers: {
          "Authorization": `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json"
        }
      }
    )

    if (!userResponse.ok) {
      console.error("❌ Erro ao buscar user info")
      return NextResponse.json({
        erro: "Erro ao buscar dados do usuário"
      }, { status: 500 })
    }

    const userData = await userResponse.json()
    const sellerID = userData.id

    console.log("✅ Seller ID:", sellerID)

    // 3️⃣ Salvar integração no banco
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in)

    // Deletar integração anterior se existir
    await prisma.mLIntegration.deleteMany({})

    await prisma.mLIntegration.create({
      data: {
        sellerID: sellerID.toString(),
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt: expiresAt
      }
    })

    console.log("✅ Integração salva no banco")

    // 4️⃣ Redirecionar para página de sucesso
    const redirectUrl = `${baseUrl}/api/ml/oauth/sucesso?seller=${sellerID}`

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error("❌ Erro no callback:", error)
    return NextResponse.json({
      erro: "Erro ao processar callback",
      mensagem: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 })
  }
}
