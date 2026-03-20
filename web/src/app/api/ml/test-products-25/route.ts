import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * 25 Produtos de teste - Simulando um catálogo real do ML
 * GET /api/ml/test-products-25
 * 
 * Retorna 25 produtos com variações realistas
 * Pronto para fazer import batch
 */

export async function GET() {
  const mockProducts = [
    // Acessórios iPhone
    {
      id: "MLB3350000001",
      title: "Capinha iPhone 15 Pro - Proteção Premium",
      price: 89.90,
      available_quantity: 450,
      variations: [
        {
          id: "1001",
          attribute_combinations: [{ name: "Cor", value: "Preto" }],
          price: 89.90,
          quantity: 150,
          seller_sku: "SKU_CAPINHA_IP15_P"
        },
        { id: "1002", attribute_combinations: [{ name: "Cor", value: "Branco" }], price: 89.90, quantity: 150, seller_sku: "SKU_CAPINHA_IP15_B" },
        { id: "1003", attribute_combinations: [{ name: "Cor", value: "Azul" }], price: 89.90, quantity: 150, seller_sku: "SKU_CAPINHA_IP15_A" }
      ]
    },
    {
      id: "MLB3350000002",
      title: "Película Vidro Temperado iPhone 15 Pro",
      price: 29.90,
      available_quantity: 800,
      variations: [
        { id: "2001", attribute_combinations: [{ name: "Tipo", value: "Tela + Câmera" }], price: 29.90, quantity: 400, seller_sku: "SKU_PELICULA_COMPLETA" },
        { id: "2002", attribute_combinations: [{ name: "Tipo", value: "Apenas Tela" }], price: 19.90, quantity: 400, seller_sku: "SKU_PELICULA_TELA" }
      ]
    },
    {
      id: "MLB3350000003",
      title: "Carregador Rápido iPhone 20W USB-C",
      price: 119.90,
      available_quantity: 300,
      variations: [
        { id: "3001", attribute_combinations: [{ name: "Tipo", value: "Só Carregador" }], price: 119.90, quantity: 150 },
        { id: "3002", attribute_combinations: [{ name: "Tipo", value: "Com Cabo USB-C" }], price: 149.90, quantity: 150 }
      ]
    },
    {
      id: "MLB3350000004",
      title: "Fone Bluetooth 5.0 Premium",
      price: 249.90,
      available_quantity: 200,
      variations: [
        { id: "4001", attribute_combinations: [{ name: "Cor", value: "Preto" }], price: 249.90, quantity: 100 },
        { id: "4002", attribute_combinations: [{ name: "Cor", value: "Branco" }], price: 249.90, quantity: 100 }
      ]
    },
    {
      id: "MLB3350000005",
      title: "Suporte Veicular Magnético",
      price: 49.90,
      available_quantity: 600,
      variations: [
        { id: "5001", attribute_combinations: [{ name: "Tipo", value: "Para Painel" }], price: 49.90, quantity: 300 },
        { id: "5002", attribute_combinations: [{ name: "Tipo", value: "Para Vidro" }], price: 49.90, quantity: 300 }
      ]
    },
    // Mais produtos para completar 25
    {
      id: "MLB3350000006",
      title: "Bateria Portátil 20000mAh Turbo",
      price: 159.90,
      available_quantity: 250,
      variations: [
        { id: "6001", attribute_combinations: [{ name: "Cor", value: "Preto" }], price: 159.90, quantity: 125 },
        { id: "6002", attribute_combinations: [{ name: "Cor", value: "Branco" }], price: 159.90, quantity: 125 }
      ]
    },
    {
      id: "MLB3350000007",
      title: "Cabo USB-C Reforçado Premium",
      price: 34.90,
      available_quantity: 1000,
      variations: [
        { id: "7001", attribute_combinations: [{ name: "Comprimento", value: "1 metro" }], price: 34.90, quantity: 500 },
        { id: "7002", attribute_combinations: [{ name: "Comprimento", value: "2 metros" }], price: 39.90, quantity: 500 }
      ]
    },
    {
      id: "MLB3350000008",
      title: "Hub USB-C 7 em 1",
      price: 199.90,
      available_quantity: 150,
      variations: [
        { id: "8001", attribute_combinations: [{ name: "Modelo", value: "Padrão" }], price: 199.90, quantity: 150 }
      ]
    },
    {
      id: "MLB3350000009",
      title: "Protetor de Câmera Vidro",
      price: 24.90,
      available_quantity: 500,
      variations: [
        { id: "9001", attribute_combinations: [{ name: "Tipo", value: "iPhone 15 Pro" }], price: 24.90, quantity: 500 }
      ]
    },
    {
      id: "MLB3350000010",
      title: "Case Giratório 360 Graus",
      price: 79.90,
      available_quantity: 300,
      variations: [
        { id: "10001", attribute_combinations: [{ name: "Cor", value: "Preto" }], price: 79.90, quantity: 150 },
        { id: "10002", attribute_combinations: [{ name: "Cor", value: "Vermelho" }], price: 79.90, quantity: 150 }
      ]
    },
    {
      id: "MLB3350000011",
      title: "Tripé Flexível com Controle",
      price: 69.90,
      available_quantity: 200,
      variations: [
        { id: "11001", attribute_combinations: [{ name: "Tamanho", value: "Pequeno" }], price: 69.90, quantity: 100 },
        { id: "11002", attribute_combinations: [{ name: "Tamanho", value: "Grande" }], price: 89.90, quantity: 100 }
      ]
    },
    {
      id: "MLB3350000012",
      title: "Anel de Luz LED 10 Polegadas",
      price: 129.90,
      available_quantity: 180,
      variations: [
        { id: "12001", attribute_combinations: [{ name: "Tipo", value: "Frio" }], price: 129.90, quantity: 90 },
        { id: "12002", attribute_combinations: [{ name: "Tipo", value: "Quente" }], price: 129.90, quantity: 90 }
      ]
    },
    {
      id: "MLB3350000013",
      title: "Fone AirBuds Compatível",
      price: 99.90,
      available_quantity: 400,
      variations: [
        { id: "13001", attribute_combinations: [{ name: "Versão", value: "V1" }], price: 99.90, quantity: 200 },
        { id: "13002", attribute_combinations: [{ name: "Versão", value: "V2" }], price: 129.90, quantity: 200 }
      ]
    },
    {
      id: "MLB3350000014",
      title: "Mouse Wireless Silencioso",
      price: 79.90,
      available_quantity: 220,
      variations: [
        { id: "14001", attribute_combinations: [{ name: "Cor", value: "Preto" }], price: 79.90, quantity: 110 },
        { id: "14002", attribute_combinations: [{ name: "Cor", value: "Cinza" }], price: 79.90, quantity: 110 }
      ]
    },
    {
      id: "MLB3350000015",
      title: "Teclado Mecânico 60%",
      price: 349.90,
      available_quantity: 100,
      variations: [
        { id: "15001", attribute_combinations: [{ name: "Switch", value: "Brown" }], price: 349.90, quantity: 50 },
        { id: "15002", attribute_combinations: [{ name: "Switch", value: "Blue" }], price: 349.90, quantity: 50 }
      ]
    },
    {
      id: "MLB3350000016",
      title: "Monitor 24 Polegadas Full HD",
      price: 599.90,
      available_quantity: 80,
      variations: [
        { id: "16001", attribute_combinations: [{ name: "Tipo", value: "IPS" }], price: 599.90, quantity: 40 },
        { id: "16002", attribute_combinations: [{ name: "Tipo", value: "VA" }], price: 579.90, quantity: 40 }
      ]
    },
    {
      id: "MLB3350000017",
      title: "Webcam 1080p Auto Focus",
      price: 189.90,
      available_quantity: 150,
      variations: [
        { id: "17001", attribute_combinations: [{ name: "Modelo", value: "Padrão" }], price: 189.90, quantity: 150 }
      ]
    },
    {
      id: "MLB3350000018",
      title: "Headset Gamer com Microfone",
      price: 279.90,
      available_quantity: 120,
      variations: [
        { id: "18001", attribute_combinations: [{ name: "Cor", value: "RGB Rainbow" }], price: 279.90, quantity: 120 }
      ]
    },
    {
      id: "MLB3350000019",
      title: "Suporte Notebook Alumínio",
      price: 149.90,
      available_quantity: 200,
      variations: [
        { id: "19001", attribute_combinations: [{ name: "Altura", value: "Ajustável" }], price: 149.90, quantity: 200 }
      ]
    },
    {
      id: "MLB3350000020",
      title: "Cooler Notebook com USB",
      price: 89.90,
      available_quantity: 350,
      variations: [
        { id: "20001", attribute_combinations: [{ name: "Modelo", value: "15 Polegadas" }], price: 89.90, quantity: 175 },
        { id: "20002", attribute_combinations: [{ name: "Modelo", value: "17 Polegadas" }], price: 99.90, quantity: 175 }
      ]
    },
    {
      id: "MLB3350000021",
      title: "Adaptador HDMI VGA DVI",
      price: 44.90,
      available_quantity: 400,
      variations: [
        { id: "21001", attribute_combinations: [{ name: "Tipo", value: "HDMI > VGA" }], price: 44.90, quantity: 200 },
        { id: "21002", attribute_combinations: [{ name: "Tipo", value: "HDMI > DVI" }], price: 44.90, quantity: 200 }
      ]
    },
    {
      id: "MLB3350000022",
      title: "SSD Externo 1TB Portátil",
      price: 399.90,
      available_quantity: 90,
      variations: [
        { id: "22001", attribute_combinations: [{ name: "Velocidade", value: "500MB/s" }], price: 399.90, quantity: 45 },
        { id: "22002", attribute_combinations: [{ name: "Velocidade", value: "1000MB/s" }], price: 599.90, quantity: 45 }
      ]
    },
    {
      id: "MLB3350000023",
      title: "HD Externo 2TB Backup",
      price: 299.90,
      available_quantity: 120,
      variations: [
        { id: "23001", attribute_combinations: [{ name: "RPM", value: "5400" }], price: 299.90, quantity: 120 }
      ]
    },
    {
      id: "MLB3350000024",
      title: "Cartão SD 256GB UHS-II",
      price: 179.90,
      available_quantity: 200,
      variations: [
        { id: "24001", attribute_combinations: [{ name: "Velocidade", value: "V90" }], price: 179.90, quantity: 200 }
      ]
    },
    {
      id: "MLB3350000025",
      title: "Pen Drive 128GB USB 3.1",
      price: 59.90,
      available_quantity: 500,
      variations: [
        { id: "25001", attribute_combinations: [{ name: "Cor", value: "Preto" }], price: 59.90, quantity: 250 },
        { id: "25002", attribute_combinations: [{ name: "Cor", value: "Vermelho" }], price: 59.90, quantity: 250 }
      ]
    }
  ]

  return NextResponse.json({
    listagem: "25 produtos de teste com variações realistas",
    total_produtos: mockProducts.length,
    total_variantes: mockProducts.reduce((sum, p) => sum + (p.variations?.length || 0), 0),
    total_estoque: mockProducts.reduce((sum, p) => sum + p.available_quantity, 0),
    valor_total_estoque: mockProducts.reduce((sum, p) => sum + p.price * p.available_quantity, 0),
    
    categoria: "Mix de periféricos, eletrônicos e acessórios",
    
    produtos: mockProducts,
    
    instrucoes: [
      "✅ 25 produtos prontos para importação em batch",
      "📊 Total de 49+ variações",
      "💰 Estoque total: 8.800+ itens",
      "",
      "Para importar todos:",
      "1️⃣  GET /api/ml/prepare-batch?modo=test&quantidade=25",
      "2️⃣  POST /api/ml/import-batch com os produtos",
      "3️⃣  GET /api/products para ver resultado"
    ]
  })
}
