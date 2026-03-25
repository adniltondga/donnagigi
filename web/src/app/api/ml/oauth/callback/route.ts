import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

/**
 * PKCE Flow - Step 2: Callback
 * GET /api/ml/oauth/callback?code=...&state=...
 *
 * O ML redireciona aqui após o usuário autorizar
 * Recupera code_verifier do cookie
 * Troca code + code_verifier por token (PKCE)
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

    console.log("[PKCE/CALLBACK] 📡 Recebido código do ML:", code.substring(0, 20) + "...")
    console.log("[PKCE/CALLBACK] state:", state?.substring(0, 10) + "...")

    // 1️⃣ Recuperar code_verifier do cookie
    const codeVerifier = request.cookies.get("ml_code_verifier")?.value
    const savedState = request.cookies.get("ml_state")?.value

    if (!codeVerifier) {
      console.error("[PKCE/CALLBACK] ❌ Code verifier não encontrado no cookie")
      console.error("[PKCE/CALLBACK] Cookies disponíveis:", request.cookies.getAll().map(c => c.name))
      return NextResponse.json({
        erro: "Code verifier não encontrado",
        descricao: "PKCE validation falhou"
      }, { status: 400 })
    }

    // Validar state se foi enviado pelo ML
    if (savedState && state !== savedState) {
      console.error("[PKCE/CALLBACK] ❌ State mismatch (CSRF attack?)")
      console.error("[PKCE/CALLBACK] Expected:", savedState, "Got:", state)
      return NextResponse.json({
        erro: "State mismatch",
        descricao: "Possível ataque CSRF"
      }, { status: 400 })
    }

    if (!state && savedState) {
      console.warn("[PKCE/CALLBACK] ⚠️ State não retornou do ML, mas foi salvo")
    }

    console.log("[PKCE/CALLBACK] ✅ Code verifier recuperado do cookie")

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

    // 6️⃣ Preparar resposta e limpar cookies
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.donnagigi.com.br"
    const redirectUrl = `${baseUrl}/api/ml/oauth/sucesso?seller=${sellerID}`

    const response = NextResponse.redirect(redirectUrl)

    // Limpar cookies
    response.cookies.set("ml_code_verifier", "", { maxAge: 0 })
    response.cookies.set("ml_state", "", { maxAge: 0 })

    console.log("[PKCE/CALLBACK] ✅ PKCE flow completo com sucesso!")
    return response
  } catch (error) {
    console.error("❌ Erro no callback:", error)
    return NextResponse.json({
      erro: "Erro ao processar callback",
      mensagem: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 })
  }
}
