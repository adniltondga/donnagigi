import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

/**
 * PARTE 4E: Dashboard de autenticação
 * GET /api/ml/status
 * 
 * Mostra:
 * - Se está autenticado
 * - Próximos passos
 * - Links para ação
 */

export async function GET(_request: NextRequest) {
  try {
    const mlIntegration = await prisma.mLIntegration.findFirst()

    if (!mlIntegration) {
      // Não autenticado
      return NextResponse.json({
        autenticado: false,
        seller_id: null,
        passo_atual: "1️⃣ FAZER LOGIN",
        instrucoes: [
          "1. Clique em 'link_login' abaixo",
          "2. Você será redirecionado ao Mercado Livre",
          "3. Autorize o acesso aos seus produtos",
          "4. Será redirecionado automaticamente",
          "5. Seu token será salvo e sincronizado"
        ],
        links: {
          fazer_login: "GET /api/ml/oauth/login",
          verificar_status: "GET /api/ml/status",
          voltarAqui: "GET /api/ml/status (quando logado)"
        }
      })
    }

    // Autenticado
    const now = new Date()
    const isExpired = now > mlIntegration.expiresAt
    const minutosAteExpirar = Math.floor(
      (mlIntegration.expiresAt.getTime() - now.getTime()) / 60000
    )

    return NextResponse.json({
      autenticado: true,
      seller_id: mlIntegration.sellerID,
      token_status: isExpired ? "❌ EXPIRADO" : "✅ VÁLIDO",
      token_expira_em: mlIntegration.expiresAt,
      minutos_ate_expirar: isExpired ? 0 : minutosAteExpirar,
      
      passo_atual: "2️⃣ LISTAR SEUS PRODUTOS",
      
      proxy_passos: [
        "✅ Você está autenticado no Mercado Livre!",
        "📦 Próximo: Listar seus produtos reais",
        "💾 Depois: Importar para seu sistema",
        "🔄 Por fim: Sincronizar em tempo real"
      ],

      links: {
        listar_produtos: "GET /api/ml/lista-reais?limit=25&offset=0",
        importar_batch: "POST /api/ml/import-batch",
        ver_locais: "GET /api/products?limit=100",
        fazer_logout: "DELETE /api/ml/logout",
        re_fazer_login: "GET /api/ml/oauth/login"
      },

      exemplo_fluxo: [
        "1. GET /api/ml/lista-reais",
        "2. Copiar retorno (array de 'produtos')",
        "3. POST /api/ml/import-batch com {produtos: [...]}"
      ]
    })
  } catch (error) {
    console.error("Erro:", error)
    return NextResponse.json({
      erro: "Erro ao verificar status",
      mensagem: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 })
  }
}
