import { NextResponse } from "next/server"
import { randomBytes, createHash } from "crypto"

export const dynamic = "force-dynamic"

// Helper para gerar code_challenge a partir de code_verifier (PKCE)
function generateCodeChallenge(codeVerifier: string): string {
  return createHash("sha256")
    .update(codeVerifier)
    .digest("base64url")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

export async function GET() {
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

    // Gerar PKCE: code_verifier e code_challenge (conforme doc ML)
    const codeVerifier = randomBytes(64).toString("base64url")
    const codeChallenge = generateCodeChallenge(codeVerifier)

    // URL EXATAMENTE conforme documentação do Mercado Livre para PKCE
    // https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=$APP_ID&redirect_uri=$YOUR_URL&code_challenge=$CODE_CHALLENGE&code_challenge_method=$CODE_METHOD
    const authUrl = `https://auth.mercadolibre.com.br/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256`

    console.log("[PKCE] Iniciando autenticação com URL:", authUrl)
    console.log("[PKCE] Code Challenge:", codeChallenge)

    const response = NextResponse.redirect(authUrl)

    // Salvar code_verifier em cookie por 10 minutos (PKCE)
    response.cookies.set("ml_code_verifier", codeVerifier, {
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
