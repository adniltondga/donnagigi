import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * PASSO 2C: Teste com produtos MOCK do Mercado Livre
 * GET /api/ml/test-products
 * 
 * Retorna:
 * - Simulação de 5 produtos reais do ML
 * - Com variações realistas
 * - Mesma estrutura que viria da API real
 * 
 * Use isto para testar a importação sem fazer login
 */

export async function GET() {
  // Simulação de produtos que viriam realmente do ML
  const mockProducts = [
    {
      id: "MLB3350000001",
      title: "Capinha iPhone 15 Pro - Proteção Premium",
      price: 89.90,
      currency_id: "BRL",
      available_quantity: 450,
      status: "active",
      category_id: "MLB5272",
      pictures: [
        {
          id: "pic_001",
          secure_url: "https://http2.mlstatic.com/D_NQ_NP_001.jpg"
        }
      ],
      description: "Capinha de proteção premium para iPhone 15 Pro. Material anti-impacto, TPU + vidro temperado. Proteção completa de câmera.",
      variations: [
        {
          id: "1001",
          attribute_combinations: [
            { name: "Cor", value: "Preto" },
            { name: "Tamanho", value: "Regular" }
          ],
          price: 89.90,
          quantity: 150,
          seller_sku: "SKU_CAPINHA_IP15_PRETO"
        },
        {
          id: "1002",
          attribute_combinations: [
            { name: "Cor", value: "Branco" },
            { name: "Tamanho", value: "Regular" }
          ],
          price: 89.90,
          quantity: 150,
          seller_sku: "SKU_CAPINHA_IP15_BRANCO"
        },
        {
          id: "1003",
          attribute_combinations: [
            { name: "Cor", value: "Azul" },
            { name: "Tamanho", value: "Regular" }
          ],
          price: 89.90,
          quantity: 150,
          seller_sku: "SKU_CAPINHA_IP15_AZUL"
        }
      ]
    },
    {
      id: "MLB3350000002",
      title: "Película Vidro Temperado iPhone 15 Pro",
      price: 29.90,
      currency_id: "BRL",
      available_quantity: 800,
      status: "active",
      category_id: "MLB5273",
      pictures: [
        {
          id: "pic_002",
          secure_url: "https://http2.mlstatic.com/D_NQ_NP_002.jpg"
        }
      ],
      description: "Película de vidro temperado para iPhone 15 Pro. Dureza 9H, transparente, fácil instalação.",
      variations: [
        {
          id: "2001",
          attribute_combinations: [
            { name: "Proteção", value: "Tela + Câmera" }
          ],
          price: 29.90,
          quantity: 400,
          seller_sku: "SKU_PELICULA_IP15_COMPLETA"
        },
        {
          id: "2002",
          attribute_combinations: [
            { name: "Proteção", value: "Apenas Tela" }
          ],
          price: 19.90,
          quantity: 400,
          seller_sku: "SKU_PELICULA_IP15_TELA"
        }
      ]
    },
    {
      id: "MLB3350000003",
      title: "Carregador rápido iPhone 20W USB-C",
      price: 119.90,
      currency_id: "BRL",
      available_quantity: 300,
      status: "active",
      category_id: "MLB5341",
      pictures: [
        {
          id: "pic_003",
          secure_url: "https://http2.mlstatic.com/D_NQ_NP_003.jpg"
        }
      ],
      description: "Carregador rápido 20W com tecnologia PD. Compatível com iPhone 12 em diante.",
      variations: [
        {
          id: "3001",
          attribute_combinations: [
            { name: "Tipo", value: "Só Carregador" }
          ],
          price: 119.90,
          quantity: 150,
          seller_sku: "SKU_CARREGADOR_20W"
        },
        {
          id: "3002",
          attribute_combinations: [
            { name: "Tipo", value: "Com Cabo USB-C" }
          ],
          price: 149.90,
          quantity: 150,
          seller_sku: "SKU_CARREGADOR_20W_CABO"
        }
      ]
    },
    {
      id: "MLB3350000004",
      title: "Fone Bluetooth 5.0 Premium",
      price: 249.90,
      currency_id: "BRL",
      available_quantity: 200,
      status: "active",
      category_id: "MLB5386",
      pictures: [
        {
          id: "pic_004",
          secure_url: "https://http2.mlstatic.com/D_NQ_NP_004.jpg"
        }
      ],
      description: "Fone com cancelamento de ruído ativo, bateria 24h, som Hi-Fi.",
      variations: [
        {
          id: "4001",
          attribute_combinations: [
            { name: "Cor", value: "Preto" }
          ],
          price: 249.90,
          quantity: 100,
          seller_sku: "SKU_FONE_BT_PRETO"
        },
        {
          id: "4002",
          attribute_combinations: [
            { name: "Cor", value: "Branco" }
          ],
          price: 249.90,
          quantity: 100,
          seller_sku: "SKU_FONE_BT_BRANCO"
        }
      ]
    },
    {
      id: "MLB3350000005",
      title: "Suporte Veicular Magnético",
      price: 49.90,
      currency_id: "BRL",
      available_quantity: 600,
      status: "active",
      category_id: "MLB5347",
      pictures: [
        {
          id: "pic_005",
          secure_url: "https://http2.mlstatic.com/D_NQ_NP_005.jpg"
        }
      ],
      description: "Suporte magnético para celular em carro. Instalação fácil no painel e vidro.",
      variations: [
        {
          id: "5001",
          attribute_combinations: [
            { name: "Modelo", value: "Para Painel" }
          ],
          price: 49.90,
          quantity: 300,
          seller_sku: "SKU_SUPORTE_PAINEL"
        },
        {
          id: "5002",
          attribute_combinations: [
            { name: "Modelo", value: "Para Vidro" }
          ],
          price: 49.90,
          quantity: 300,
          seller_sku: "SKU_SUPORTE_VIDRO"
        }
      ]
    }
  ]

  return NextResponse.json({
    passo: "🧪 TESTE COM PRODUTOS MOCK",
    mensagem: "Estes são 5 produtos simulados com a mesma estrutura do ML real",
    aviso: "Use estes para testar a importação. Depois faça login real em /api/ml/login-start",
    
    produtos: mockProducts,
    
    resumo: {
      total_produtos: mockProducts.length,
      total_variacoes: mockProducts.reduce((sum, p) => sum + (p.variations?.length || 0), 0),
      estoque_total: mockProducts.reduce((sum, p) => sum + p.available_quantity, 0)
    },

    proximos_passos: [
      "1️⃣  Copie um produto desta resposta",
      "2️⃣  Use em POST /api/ml/import-product para inserir no banco",
      "3️⃣  Verifique em GET /api/products",
      "4️⃣  Quando pronto, faça login real em /api/ml/login-start"
    ],

    endpoints_disponiveis: {
      "GET /api/ml/structure": "Ver estrutura esperada",
      "GET /api/ml/test-products": "Este endpoint (produtos mock)",
      "POST /api/ml/import-product": "Importar um produto (use teste aqui!)",
      "GET /api/ml/list-products": "Listar reais (precisa estar autenticado)",
      "GET /api/ml/get-product/{id}": "Detalhes de um produto real"
    }
  })
}
