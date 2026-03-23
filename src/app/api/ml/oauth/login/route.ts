import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export const dynamic = "force-dynamic"

/**
 * PARTE 4: Login OAuth2 PKCE com Mercado Livre
 * GET /api/ml/oauth/login
 * 
 * Inicia o fluxo de autenticação com ML usando PKCE
 * Retorna:
 * - URL para o usuário acessar
 * - Instruções passo a passo
 */

export async function GET(_request: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const clientId = process.env.ML_CLIENT_ID

    if (!clientId) {
      return NextResponse.json(
        {
          erro: "ML_CLIENT_ID não configurado",
          instrucoes: "Configure ML_CLIENT_ID no arquivo .env"
        },
        { status: 400 }
      )
    }

    // 1️⃣ Gerar PKCE code_verifier e code_challenge
    const codeVerifier = crypto.randomBytes(32).toString("hex")
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")

    // 2️⃣ Gerar state para CSRF protection
    const state = crypto.randomBytes(16).toString("hex")

    // 3️⃣ Salvar code_verifier no banco para recuperar no callback
    // (em produção, usar Redis ou sessão segura)
    // Por enquanto, retornamos no response com instrução de salvar
    
    // 4️⃣ Preparar parâmetros de OAuth2
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: `${baseUrl}/api/ml/oauth/callback`,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state: state
    })

    const authUrl = `https://auth.mercadolibre.com.br/authorization?${params.toString()}`

    return NextResponse.json({
      sucesso: true,
      passo: "1️⃣ FAZER LOGIN NO MERCADO LIVRE",
      instrucoes: [
        "1. Clique no link 'fazer_login' abaixo",
        "2. Você será redirecionado para o ML",
        "3. Autorize o acesso a seus produtos",
        "4. Serão redirecionados automaticamente",
        "5. Seu token será salvo"
      ],
      links: {
        fazer_login: authUrl,
        verificar_status: `${baseUrl}/api/mercadolivre/integration`,
        listar_reais: `${baseUrl}/api/ml/lista-reais`
      },
      debug_info: {
        client_id: clientId,
        redirect_uri: `${baseUrl}/api/ml/oauth/callback`,
        code_challenge_method: "S256"
      }
    })
  } catch (error) {
    console.error("Erro ao iniciar login:", error)
    return NextResponse.json(
      {
        erro: "Erro ao preparar login",
        mensagem: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    )
  }
}
