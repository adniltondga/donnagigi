import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export const dynamic = "force-dynamic"

/**
 * PKCE Flow - Step 1: Login
 * GET /api/ml/oauth/login
 *
 * Gera code_verifier e code_challenge (PKCE)
 * Salva code_verifier em cookie httpOnly
 * Redireciona para autenticação do ML
 */

function generateCodeChallenge(codeVerifier: string): string {
  return crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

export async function GET(_request: NextRequest) {
  try {
    const clientId = process.env.ML_CLIENT_ID
    const redirectUri = process.env.ML_REDIRECT_URI || "https://www.donnagigi.com.br/api/ml/oauth/callback"

    if (!clientId) {
      return NextResponse.json(
        {
          erro: "ML_CLIENT_ID não configurado",
          instrucoes: "Configure ML_CLIENT_ID no arquivo .env"
        },
        { status: 400 }
      )
    }

    // 1️⃣ Gerar PKCE code_verifier (43-128 caracteres)
    const codeVerifier = crypto.randomBytes(32).toString("base64url")
    const codeChallenge = generateCodeChallenge(codeVerifier)

    // 2️⃣ Gerar state para CSRF protection
    const state = crypto.randomBytes(16).toString("hex")

    console.log("[PKCE/LOGIN] Gerando fluxo PKCE")
    console.log("[PKCE/LOGIN] code_verifier:", codeVerifier.substring(0, 20) + "...")
    console.log("[PKCE/LOGIN] code_challenge:", codeChallenge)

    // 3️⃣ Preparar parâmetros OAuth2 com PKCE
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      scope: "offline_access read",
      state: state
    })

    const authUrl = `https://auth.mercadolivre.com.br/authorization?${params.toString()}`

    // 4️⃣ Redirecionar para ML e salvar code_verifier em cookie
    const response = NextResponse.redirect(authUrl)

    response.cookies.set("ml_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutos
      path: "/"
    })

    response.cookies.set("ml_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/"
    })

    console.log("[PKCE/LOGIN] ✅ Redirecionando para ML com PKCE")
    return response
  } catch (error) {
    console.error("❌ Erro ao iniciar login:", error)
    return NextResponse.json(
      {
        erro: "Erro ao preparar login",
        mensagem: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    )
  }
}
