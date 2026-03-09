import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.ML_CLIENT_ID
    const redirectUri = process.env.ML_REDIRECT_URI || "http://localhost:3000/api/mercadolivre/callback"
    const state = Math.random().toString(36).substring(7) // State aleatório para segurança

    // Salvar state na sessão (você pode usar cookies ou banco de dados)
    const response = NextResponse.redirect(
      `https://auth.mercadolibre.com.br/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
    )

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
      { error: "Erro ao iniciar autenticação" },
      { status: 500 }
    )
  }
}
