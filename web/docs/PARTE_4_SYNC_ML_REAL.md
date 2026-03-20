/**
 * PARTE 4 - SINCRONIZAÇÃO COM MERCADO LIVRE REAL
 * ================================================
 * 
 * Fluxo completo de autenticação OAuth2 PKCE com Mercado Livre
 * e sincronização de produtos em tempo real
 */

const ENDPOINTS = {
  // 🔐 AUTENTICAÇÃO
  "GET /api/ml/oauth/login": {
    descricao: "Iniciar fluxo de login OAuth2 com Mercado Livre",
    retorna: {
      sucesso: true,
      passo: "1️⃣ FAZER LOGIN NO MERCADO LIVRE",
      links: {
        fazer_login: "https://auth.mercadolibre.com.br/authorization?..."
      }
    },
    notas: [
      "Gera novo código de desafio PKCE",
      "URL expira a cada 5 minutos",
      "Você só precisa fazer login UMA VEZ"
    ]
  },

  "GET /api/ml/oauth/callback": {
    descricao: "Callback automático do Mercado Livre (não chamar manualmente)",
    fluxo: "ML → /callback → Troca código por token → Salva no banco",
    notas: ["Automático - não acesse manualmente"]
  },

  "GET /api/ml/oauth/sucesso": {
    descricao: "Página de sucesso após login (redirecionamento automático)",
    retorna: "Mensagem de sucesso com próximos passos"
  },

  // 📊 STATUS
  "GET /api/ml/status": {
    descricao: "Verificar se está autenticado e timeout do token",
    retorna: {
      autenticado: true,
      seller_id: "123456789",
      token_status: "✅ VÁLIDO",
      minutos_ate_expirar: 240
    }
  },

  // 📦 PRODUTOS
  "GET /api/ml/lista-reais?limit=25&offset=0": {
    descricao: "Listar seus produtos REAIS do Mercado Livre",
    parametros: {
      limit: "Quantidade (máximo 25)",
      offset: "Para paginação"
    },
    retorna: {
      autenticado: true,
      seller_id: "123456789",
      produtos: [
        {
          id: "MLB123",
          title: "Seu produto real",
          price: 99.90,
          available_quantity: 100,
          variations: []
        }
      ],
      resumo: {
        total_listados: 25,
        total_estoque: 2500,
        valor_total: 249500
      }
    },
    notas: [
      "Requer estar autenticado (faça login antes)",
      "Retorna estrutura compatível com import-batch",
      "Busca dados em TEMPO REAL do ML"
    ]
  },

  // 💾 IMPORTAÇÃO
  "POST /api/ml/import-batch": {
    descricao: "Importar múltiplos produtos (funciona com produtos do ML ou testes)",
    body: {
      produtos: [
        {
          id: "MLB123",
          title: "Produto",
          price: 99.90,
          available_quantity: 100,
          variations: []
        }
      ]
    },
    retorna: {
      resumo: {
        total_processado: 25,
        total_importado: 25,
        total_variantes: 44,
        taxa_sucesso: "100%"
      }
    }
  },

  // 📚 GUIAS
  "GET /api/ml/guia": {
    descricao: "Guia completo de sincronização (JSON)",
    retorna: "Instruções passo a passo em formato JSON"
  },

  "GET /api/ml/dashboard": {
    descricao: "Dashboard interativo em HTML com botão de login",
    retorna: "Página HTML com UI amigável",
    notas: ["Ideal para começar - abra no browser"]
  }
}

const FLUXO_COMPLETO = {
  passo_1: {
    nome: "Obter link de login",
    comando: "GET /api/ml/oauth/login",
    resultado: "Link para autenticação"
  },

  passo_2: {
    nome: "Clicar no link e fazer login",
    onde: "Browser",
    resultado: "Redirecionado para o Mercado Livre"
  },

  passo_3: {
    nome: "Autorizar acesso",
    onde: "Mercado Livre",
    resultado: "Redirecionado de volta (automático)"
  },

  passo_4: {
    nome: "Token salvo no banco",
    onde: "Sistema automaticamente",
    resultado: "MLIntegration criado com token + refresh"
  },

  passo_5: {
    nome: "Listar produtos reais do ML",
    comando: "GET /api/ml/lista-reais",
    resultado: "Array de seus produtos do ML"
  },

  passo_6: {
    nome: "Importar no seu sistema",
    comando: "POST /api/ml/import-batch",
    resultado: "Produtos e variantes criados no banco local"
  },

  passo_7: {
    nome: "Ver produtos sincronizados",
    comando: "GET /api/products",
    resultado: "Seus produtos do ML agora no sistema local"
  }
}

const ARQUIVOS_CRIADOS = [
  "/src/app/api/ml/oauth/login/route.ts - Iniciar login",
  "/src/app/api/ml/oauth/callback/route.ts - Processar callback",
  "/src/app/api/ml/oauth/sucesso/route.ts - Página de sucesso",
  "/src/app/api/ml/lista-reais/route.ts - Listar produtos reais",
  "/src/app/api/ml/status/route.ts - Status de autenticação",
  "/src/app/api/ml/guia/route.ts - Guia em JSON",
  "/src/app/api/ml/dashboard/route.ts - Dashboard HTML"
]

const CREDENCIAIS_NECESSARIAS = {
  "NEXT_PUBLIC_BASE_URL": "http://localhost:3000 (ou URL de produção)",
  "ML_CLIENT_ID": "Obtido ao registrar app no ML",
  "ML_CLIENT_SECRET": "Obtido ao registrar app no ML",
  "ML_REDIRECT_URI": "Sua URL de callback"
}

// EXEMPLO DE USO
const EXEMPLO_COMPLETO = `
# 1. Abrir dashboard (interface visual)
http://localhost:3000/api/ml/dashboard

# 2. Ou fazer tudo via API

# 2a. Obter link de login
curl http://localhost:3000/api/ml/oauth/login

# 2b. Copiar a URL de fazer_login e acessar no browser
# (você será redirecionado automaticamente após login)

# 2c. Verificar se está autenticado
curl http://localhost:3000/api/ml/status

# 2d. Listar seus produtos reais do ML
curl http://localhost:3000/api/ml/lista-reais | jq '.produtos' > /tmp/seus_produtos.json

# 2e. Importar no seu sistema
curl -X POST http://localhost:3000/api/ml/import-batch \
  -H "Content-Type: application/json" \
  -d '{"produtos": [...]}'  # Cole o array de .produtos

# 2f. Ver produtos sincronizados
curl http://localhost:3000/api/products
`

console.log(JSON.stringify({
  ENDPOINTS,
  FLUXO_COMPLETO,
  ARQUIVOS_CRIADOS,
  CREDENCIAIS_NECESSARIAS,
  EXEMPLO_COMPLETO
}, null, 2))
