import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * PASSO 3B: Preparar batch para importação
 * GET /api/ml/prepare-batch?modo=test&quantidade=25
 * 
 * Retorna:
 * - Array de produtos prontos para importar em batch
 * - JSON formatado para colar direto no POST /api/ml/import-batch
 * 
 * Query params:
 * - modo: "test" (mock products) ou "real" (API do ML, precisa autenticado)
 * - quantidade: quantos produtos (padrão 5, máximo 25)
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const modo = searchParams.get("modo") || "test"
    const quantidade = Math.min(
      parseInt(searchParams.get("quantidade") || "5"),
      25
    )

    if (modo === "test") {
      // Buscar produtos de teste
      const testResponse = await fetch(
        `http://localhost:3000/api/ml/test-products`
      )
      const testData = await testResponse.json()

      // Pegar apenas a quantidade solicitada
      const produtosSelecionados = testData.produtos.slice(0, quantidade)

      // Formatar como batch
      const batch = {
        descricao: `Batch de ${produtosSelecionados.length} produtos TEST`,
        modo: "test",
        data: new Date().toISOString(),
        produtos: produtosSelecionados
      }

      return NextResponse.json({
        preparado: true,
        quantidade: produtosSelecionados.length,
        instrucoes: [
          "1️⃣ Copie o objeto 'batch' completo abaixo",
          "2️⃣ Faça POST para /api/ml/import-batch",
          `3️⃣ Coloque no body JSON: { "produtos": <array de produtos> }`,
          "4️⃣ Você pode colar diretamente o 'batch.produtos' como array"
        ],
        batch,
        curl_exemplo: `curl -X POST http://localhost:3000/api/ml/import-batch \\
  -H "Content-Type: application/json" \\
  -d '{"produtos": ${JSON.stringify(produtosSelecionados).substring(0, 100)}...}'`
      })
    }

    if (modo === "real") {
      return NextResponse.json({
        erro: "Modo 'real' requer autenticação no ML",
        instrucoes: [
          "1️⃣ Faça login em GET /api/ml/login-start",
          "2️⃣ Depois use ?modo=real&quantidade=25"
        ]
      })
    }

    return NextResponse.json(
      {
        erro: "Modo inválido",
        modos_validos: ["test", "real"]
      },
      { status: 400 }
    )
  } catch (error) {
    console.error("Erro:", error)
    return NextResponse.json(
      {
        erro: "Erro ao preparar batch",
        mensagem: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    )
  }
}
