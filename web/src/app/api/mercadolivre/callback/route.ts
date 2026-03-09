import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    // Verificar se houve erro
    if (error) {
      return NextResponse.redirect(
        `/admin/integracao?error=${encodeURIComponent(error)}`
      )
    }

    if (!code) {
      return NextResponse.redirect("/admin/integracao?error=No authorization code")
    }

    // Verificar state para segurança
    const savedState = request.cookies.get("ml_oauth_state")?.value
    if (state !== savedState) {
      return NextResponse.redirect("/admin/integracao?error=Invalid state")
    }

    // Trocar código por token de acesso
    const clientId = process.env.ML_CLIENT_ID
    const clientSecret = process.env.ML_CLIENT_SECRET
    const redirectUri = process.env.ML_REDIRECT_URI || "http://localhost:3000/api/mercadolivre/callback"

    const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
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
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json()
      console.error("Erro ao obter token:", error)
      return NextResponse.redirect(
        `/admin/integracao?error=${encodeURIComponent(error.message || "Erro ao obter token")}`
      )
    }

    const tokenData = await tokenResponse.json()

    // Obter ID do seller
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    if (!userResponse.ok) {
      console.error("Erro ao obter informações do usuário")
      return NextResponse.redirect(
        "/admin/integracao?error=Erro ao obter informações do usuário"
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
    const integration = await prisma.mLIntegration.create({
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        sellerID: userData.id.toString(),
        expiresAt,
      },
    })

    // Redirecionar com sucesso
    const response = NextResponse.redirect(
      `/admin/integracao?success=Mercado Livre conectado com sucesso!&seller=${userData.id}&expiresAt=${expiresAt.toISOString()}`
    )

    // Limpar state cookie
    response.cookies.set("ml_oauth_state", "", {
      maxAge: 0,
    })

    return response
  } catch (error) {
    console.error("Erro no callback do Mercado Livre:", error)
    return NextResponse.redirect(
      "/admin/integracao?error=Erro ao processar autenticação"
    )
  }
}
