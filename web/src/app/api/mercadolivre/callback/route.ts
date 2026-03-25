import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // Construir base URL absoluta no escopo externo do try/catch 
  // para que seja acessível no catch
  const host = request.headers.get("host") || "www.donnagigi.com.br"
  const protocol = host.includes("localhost") ? "http" : "https"
  const baseUrl = `${protocol}://${host}`

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const error = searchParams.get("error")

    console.log("[CALLBACK] Iniciando callback...")
    console.log("[CALLBACK] Host:", host)
    console.log("[CALLBACK] Base URL:", baseUrl)
    console.log("[CALLBACK] Code recebido:", code ? "✓" : "✗")
    console.log("[CALLBACK] Error:", error)

    // Verificar se houve erro
    if (error) {
      console.error("[CALLBACK] Erro do ML:", error)
      return NextResponse.redirect(
        `${baseUrl}/admin/integracao?error=${encodeURIComponent(error)}`
      )
    }

    if (!code) {
      console.error("[CALLBACK] Nenhum code recebido")
      return NextResponse.redirect(`${baseUrl}/admin/integracao?error=No authorization code`)
    }

    // Trocar código por token de acesso (com PKCE)
    const clientId = process.env.ML_CLIENT_ID
    const clientSecret = process.env.ML_CLIENT_SECRET
    const redirectUri = process.env.ML_REDIRECT_URI || "https://www.donnagigi.com.br/api/mercadolivre/callback"
    const codeVerifier = request.cookies.get("ml_code_verifier")?.value

    console.log("[CALLBACK] clientId:", clientId ? "✓" : "✗")
    console.log("[CALLBACK] clientSecret:", clientSecret ? "✓" : "✗")
    console.log("[CALLBACK] redirectUri:", redirectUri)
    console.log("[CALLBACK] codeVerifier:", codeVerifier ? "✓" : "✗")

    if (!codeVerifier) {
      console.error("[CALLBACK] Code verifier não encontrado no cookie")
      console.error("[CALLBACK] Cookies disponíveis:", request.cookies.getAll().map(c => c.name))
      return NextResponse.redirect(`${baseUrl}/admin/integracao?error=PKCE validation failed: code_verifier missing`)
    }

    console.log("[PKCE] Trocando código por token com code_verifier")

    let tokenResponse
    try {
      tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId!,
          client_secret: clientSecret!,
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }).toString(),
      })
    } catch (fetchError) {
      console.error("[CALLBACK] Erro ao conectar em api.mercadolibre.com:", fetchError)
      // Retornar com mensagem de erro mais clara
      return NextResponse.redirect(
        `${baseUrl}/admin/integracao?error=${encodeURIComponent("Erro ao conectar com servidor do Mercado Livre. Tente novamente em alguns segundos.")}`
      )
    }

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      console.error("[CALLBACK] Erro HTTP ao obter token:", {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorData
      })
      return NextResponse.redirect(
        `${baseUrl}/admin/integracao?error=${encodeURIComponent(errorData.message || "Erro ao obter token do Mercado Livre")}`
      )
    }

    const tokenData = await tokenResponse.json()

    // Obter ID do seller
    let userResponse
    try {
      userResponse = await fetch("https://api.mercadolibre.com/users/me", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      })
    } catch (fetchError) {
      console.error("[CALLBACK] Erro ao conectar em api.mercadolibre.com/users/me:", fetchError)
      return NextResponse.redirect(
        `${baseUrl}/admin/integracao?error=${encodeURIComponent("Erro ao obter informações do usuário. Tente novamente.")}`
      )
    }

    if (!userResponse.ok) {
      const errorData = await userResponse.json().catch(() => ({}))
      console.error("[CALLBACK] Erro ao obter informações do usuário:", {
        status: userResponse.status,
        statusText: userResponse.statusText,
        error: errorData
      })
      return NextResponse.redirect(
        `${baseUrl}/admin/integracao?error=Erro ao obter informações do usuário`
      )
    }

    const userData = await userResponse.json()

    // Salvar integração no banco
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    // Deletar integração anterior se existir
    const existing = await prisma.mLIntegration.findFirst()
    if (existing) {
      await prisma.mLIntegration.delete({
        where: { id: existing.id },
      })
    }

    // Criar nova integração
    void await prisma.mLIntegration.create({
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        sellerID: userData.id.toString(),
        expiresAt,
      },
    })

    // Redirecionar com sucesso
    const response = NextResponse.redirect(
      `${baseUrl}/admin/integracao?success=Mercado Livre conectado com sucesso!&seller=${userData.id}&expiresAt=${expiresAt.toISOString()}`
    )

    // Limpar code_verifier cookie
    response.cookies.set("ml_code_verifier", "", {
      maxAge: 0,
    })

    console.log("[PKCE] ✅ OAuth com PKCE completado com sucesso")
    return response
  } catch (error) {
    console.error("[CALLBACK] Erro no callback:", error)
    return NextResponse.redirect(
      `${baseUrl}/admin/integracao?error=Erro ao processar autenticação`
    )
  }
}
