import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.ML_CLIENT_ID
    const clientSecret = process.env.ML_CLIENT_SECRET
    const redirectUri = process.env.ML_REDIRECT_URI || "http://localhost:3000/api/mercadolivre/callback"
    
    // Validar variáveis de ambiente
    if (!clientId || !clientSecret) {
      console.error("Variáveis de ambiente não configuradas:", {
        clientId: clientId ? "✓" : "✗",
        clientSecret: clientSecret ? "✓" : "✗",
        redirectUri: "✓",
      })
      return NextResponse.json(
        {
          error: "Integração não configurada",
          details: "Variáveis de ambiente ML_CLIENT_ID e ML_CLIENT_SECRET não encontradas",
        },
        { status: 500 }
      )
    }

    const state = Math.random().toString(36).substring(7)
    const authUrl = `https://auth.mercadolibre.com.br/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`

    console.log("Iniciando autenticação com URL:", authUrl)

    const response = NextResponse.redirect(authUrl)

    // Salvar state em cookie por 10 minutos
    response.cookies.set("ml_oauth_state", state, {
      httpOnly: true,
      secure: false,
      maxAge: 600,
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Erro ao iniciar autenticação do Mercado Livre:", error)
    return NextResponse.json(
      {
        error: "Erro ao iniciar autenticação",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}
