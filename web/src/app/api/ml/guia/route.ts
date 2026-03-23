import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * PARTE 4F: Guia completo para sincronizar com ML
 * GET /api/ml/guia
 * 
 * Mostra passo a passo como fazer o login e sincronizar
 */

export async function GET(_request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  // Buscar status de autenticação
  const statusResponse = await fetch(`${baseUrl}/api/ml/status`)
  const status = await statusResponse.json()

  return NextResponse.json({
    titulo: "🚀 GUIA DE SINCRONIZAÇÃO COM MERCADO LIVRE",
    versao: "Parte 4 - Integração Real",

    autenticado: status.autenticado,

    passo_a_passo: status.autenticado
      ? [
          {
            numero: "1✅",
            titulo: "Você está autenticado!",
            descricao: "Seu token está salvo e válido"
          },
          {
            numero: "2️⃣",
            titulo: "Listar seus produtos do ML",
            comando: "curl http://localhost:3000/api/ml/lista-reais",
            detalhes: "Retorna todos seus produtos do Mercado Livre com variações"
          },
          {
            numero: "3️⃣",
            titulo: "Copiar e importar no seu sistema",
            comando: "POST /api/ml/import-batch",
            detalhes: "Colar o array de 'produtos' da resposta anterior"
          },
          {
            numero: "4✅",
            titulo: "Pronto!",
            detalhes: "Seus produtos estão sincronizados e prontos para gerenciar"
          }
        ]
      : [
          {
            numero: "1️⃣",
            titulo: "Fazer login no Mercado Livre",
            link: "https://auth.mercadolibre.com.br/authorization?response_type=code&client_id=1656045364090057&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fml%2Foauth%2Fcallback&code_challenge=UygoKI0N6UoOYrDLiae09GTJDcQM4pN40oG47v63kew&code_challenge_method=S256&state=d63f484df1f4f739d47213eef17c1639",
            acesso_rapido: "GET /api/ml/oauth/login para obter link atual",
            instrucoes: [
              "1. Clique no link acima",
              "2. Você será redirecionado ao Mercado Livre",
              "3. Faça login com sua conta",
              "4. Autorize o acesso aos seus produtos",
              "5. Será redirecionado automaticamente"
            ]
          },
          {
            numero: "2️⃣",
            titulo: "Após fazer login, volte aqui",
            comando: "GET /api/ml/status",
            detalhes: "Você verá que está autenticado"
          },
          {
            numero: "3️⃣",
            titulo: "Listar seus produtos",
            comando: "GET /api/ml/lista-reais",
            detalhes: "Retorna todos seus produtos do ML"
          }
        ],

    endpoints: {
      status: {
        metodo: "GET",
        url: "/api/ml/status",
        descricao: "Ver se está autenticado"
      },
      login: {
        metodo: "GET",
        url: "/api/ml/oauth/login",
        descricao: "Obter link de login"
      },
      listar: {
        metodo: "GET",
        url: "/api/ml/lista-reais?limit=25&offset=0",
        descricao: "Listar produtos do ML (após login)"
      },
      importar: {
        metodo: "POST",
        url: "/api/ml/import-batch",
        descricao: "Importar múltiplos produtos"
      }
    },

    dicas: [
      "💡 Links do OAuth expiram a cada 5min, então gere um novo se precisar",
      "💡 Você só precisa fazer login UMA VEZ, o token é salvo",
      "💡 O token dura ~6 horas, depois precisa fazer login novamente",
      "💡 Use mesmo browser para manter sessão (não pode testar em incógnito ao mesmo tempo)"
    ]
  })
}
