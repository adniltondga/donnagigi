import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * PARTE 4C: Página de sucesso do login
 * GET /api/ml/oauth/sucesso?seller=...
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const seller = searchParams.get("seller")

  return NextResponse.json({
    sucesso: true,
    mensagem: "✅ Login no Mercado Livre realizado com sucesso!",
    seller_id: seller,
    proximos_passos: [
      "1️⃣ Agora você pode listar seus produtos",
      "2️⃣ Use GET /api/ml/lista-reais",
      "3️⃣ Sincronize com seu catálogo",
      "4️⃣ Gerencie estoque em tempo real"
    ],
    endpoints: {
      status: "GET /api/mercadolivre/integration",
      listar_produtos: "GET /api/ml/lista-reais?limit=25&offset=0",
      importar_batch: "POST /api/ml/import-batch",
      ver_produtos_locais: "GET /api/products?limit=100"
    }
  })
}
