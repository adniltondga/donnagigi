import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

/**
 * PASSO 2B: Iniciar login OAuth2 PKCE com Mercado Livre
 * GET /api/ml/login-start
 * 
 * Retorna:
 * - URL para o usuário clicar
 * - Instruções para capturar o código de retorno
 */

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  
  // Gerar PKCE code_verifier e code_challenge
  const codeVerifier = crypto.randomBytes(32).toString("hex")
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")

  // Parâmetros do OAuth2
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.MERCADO_LIVRE_CLIENT_ID || "seu_client_id",
    redirect_uri: `${baseUrl}/api/ml/login-callback`,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: crypto.randomBytes(16).toString("hex")
  })

  const authUrl = `https://auth.mercadolibre.com.br/authorization?${params.toString()}`

  return NextResponse.json({
    passo: "1️⃣ FAÇA LOGIN NO MERCADO LIVRE",
    instrucoes: [
      "1. Clique no link abaixo para autenticar",
      "2. Você será redirecionado a um callback",
      "3. O callback salvará seu token automaticamente",
      "4. Depois chame GET /api/mercadolivre/integration para verificar"
    ],
    links: {
      fazer_login: authUrl,
      verificar_status: `${baseUrl}/api/mercadolivre/integration`,
      listar_produtos: `${baseUrl}/api/ml/list-products`
    },
    informacoes_necesarias: {
      MERCADO_LIVRE_CLIENT_ID: process.env.MERCADO_LIVRE_CLIENT_ID ? "✅ Configurado" : "❌ Falta configurar em .env",
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ? "✅ Configurado" : "⚠️ Usando http://localhost:3000"
    }
  })
}
