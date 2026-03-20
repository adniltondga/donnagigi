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
    const redirectUri = process.env.ML_REDIRECT_URI || "https://www.donnagigi.com.br/api/mercadolivre/callback"
    
    console.log("[AUTH] Redirect URI:", redirectUri)
    
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

    // Scopes necessários para sincronizar produtos
    // read = Permissão de leitura (listagens, produtos, usuário)
    // offline_access = Refresh token para manter token ativo
    const scopes = ["offline_access", "read"]
    const scopeString = scopes.join(" ")

    // URL conforme documentação do Mercado Livre com PKCE + scopes
    const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256&scope=${encodeURIComponent(scopeString)}`

    console.log("[PKCE] Iniciando autenticação com URL:", authUrl)
    console.log("[PKCE] Code Challenge:", codeChallenge)
    console.log("[PKCE] Redirect URI sendo enviado:", redirectUri)
    console.log("[PKCE] Client ID:", clientId)

    const response = NextResponse.redirect(authUrl)

    // Salvar code_verifier em cookie por 10 minutos (PKCE)
    response.cookies.set("ml_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: false, // Em dev é http, em prod é https (ajustado automaticamente)
      sameSite: "lax", // Permite que cookie seja enviado no redirect de volta
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
