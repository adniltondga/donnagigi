import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

/**
 * PKCE Flow - Step 2: Callback
 * GET /api/ml/oauth/callback?code=...&state=...
 *
 * O ML redireciona aqui após o usuário autorizar.
 * Recupera code_verifier do banco usando o state.
 * Troca code + code_verifier por token (PKCE).
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    // Verificar se houve erro de autorização
    if (error) {
      console.error("[PKCE/CALLBACK] Erro do ML:", error)
      return NextResponse.json({
        erro: "Autorização negada",
        motivo: error,
        descricao: searchParams.get("error_description")
      })
    }

    if (!code) {
      console.error("[PKCE/CALLBACK] Nenhum code recebido")
      return NextResponse.json({
        erro: "Código não fornecido pelo ML"
      }, { status: 400 })
    }

    if (!state) {
      console.error("[PKCE/CALLBACK] Nenhum state recebido")
      return NextResponse.json({
        erro: "State não fornecido pelo ML",
        descricao: "Não foi possível validar o fluxo PKCE"
      }, { status: 400 })
    }

    console.log("[PKCE/CALLBACK] 📡 Recebido código do ML:", code.substring(0, 20) + "...")
    console.log("[PKCE/CALLBACK] state:", state.substring(0, 10) + "...")

    // 1️⃣ Recuperar code_verifier do banco usando state
    const oauthState = await prisma.mLOAuthState.findUnique({
      where: { state }
    })

    if (!oauthState) {
      console.error("[PKCE/CALLBACK] ❌ State não encontrado no banco")
      return NextResponse.json({
        erro: "State inválido",
        descricao: "Fluxo PKCE não iniciado ou expirado"
      }, { status: 400 })
    }

    // Consumir o state imediatamente (one-shot, previne replay)
    await prisma.mLOAuthState.delete({ where: { state } })

    if (oauthState.expiresAt < new Date()) {
      console.error("[PKCE/CALLBACK] ❌ State expirado")
      return NextResponse.json({
        erro: "State expirado",
        descricao: "O fluxo de login demorou demais. Inicie novamente."
      }, { status: 400 })
    }

    const codeVerifier = oauthState.codeVerifier
    console.log("[PKCE/CALLBACK] ✅ code_verifier recuperado do banco")

    // 2️⃣ Obter credenciais
    const clientId = process.env.ML_CLIENT_ID
    const clientSecret = process.env.ML_CLIENT_SECRET
    const redirectUri = process.env.ML_REDIRECT_URI || "https://www.donnagigi.com.br/api/ml/oauth/callback"

    if (!clientId || !clientSecret) {
      console.error("[PKCE/CALLBACK] ❌ Credenciais ML não configuradas")
      return NextResponse.json({
        erro: "Credenciais ML não configuradas"
      }, { status: 500 })
    }

    // 3️⃣ Trocar código por token (com PKCE)
    console.log("[PKCE/CALLBACK] 📡 Trocando código por token com PKCE...")

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })

    const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      body: tokenParams.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error("[PKCE/CALLBACK] ❌ Erro ao trocar código:", errorData)
      return NextResponse.json({
        erro: "Erro ao trocar código por token",
        detalhes: errorData
      }, { status: tokenResponse.status })
    }

    const tokenData = await tokenResponse.json()
    console.log("[PKCE/CALLBACK] ✅ Token recebido do ML")

    // 4️⃣ Buscar informações do usuário (seller ID)
    console.log("[PKCE/CALLBACK] 📡 Buscando dados do usuário...")

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
      const errorData = await userResponse.json().catch(() => ({}))
      console.error("[PKCE/CALLBACK] ❌ Erro ao buscar user info:", errorData)
      return NextResponse.json({
        erro: "Erro ao buscar dados do usuário",
        detalhes: errorData
      }, { status: 500 })
    }

    const userData = await userResponse.json()
    const sellerID = userData.id

    console.log("[PKCE/CALLBACK] ✅ Seller ID:", sellerID)

    // 5️⃣ Salvar integração no banco
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in)

    console.log("[PKCE/CALLBACK] 💾 Salvando integração no banco...")

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

    console.log("[PKCE/CALLBACK] ✅ Integração salva no banco")

    // 6️⃣ Redirecionar para a tela de integração com mensagem de sucesso
    const successMsg = encodeURIComponent(`Conectado ao Mercado Livre (seller ${sellerID})`)
    const redirectUrl = new URL(`/admin/integracao?success=${successMsg}`, request.nextUrl.origin)

    console.log("[PKCE/CALLBACK] ✅ PKCE flow completo com sucesso!")
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error("❌ Erro no callback:", error)
    return NextResponse.json({
      erro: "Erro ao processar callback",
      mensagem: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 })
  }
}
