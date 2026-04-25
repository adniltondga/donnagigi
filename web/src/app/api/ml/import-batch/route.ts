import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { AuthError, authErrorResponse, requireRole } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * PASSO 3: Importar múltiplos produtos em BATCH
 * POST /api/ml/import-batch
 * 
 * Body:
 * {
 *   produtos: [{id, title, price, variations, ...}, ...]
 * }
 * 
 * Retorna:
 * - Status de cada produto
 * - Resumo de sucesso/erro
 * - Total de variantes criadas
 */

interface MLVariation {
  id: string
  attribute_combinations?: Array<{ name: string; value: string }>
  price: number
  quantity: number
  seller_sku?: string
  user_product_id?: string
}

interface MLProduct {
  id: string
  title: string
  price: number
  available_quantity: number
  variations?: MLVariation[]
  description?: string
}

interface BatchRequest {
  produtos: MLProduct[]
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['OWNER', 'ADMIN'])
    const body = (await request.json()) as BatchRequest

    if (!body.produtos || !Array.isArray(body.produtos)) {
      return NextResponse.json(
        {
          erro: "Body inválido",
          esperado: { produtos: [] }
        },
        { status: 400 }
      )
    }

    const { getDefaultTenantId } = await import("@/lib/tenant")
    const tenantId = await getDefaultTenantId()

    console.log(`📦 Iniciando importação de ${body.produtos.length} produtos...`)

    const resultados = {
      sucesso: 0,
      erro: 0,
      total_variantes: 0,
      total_estoque: 0,
      produtos_resultado: [] as any[]
    }

    // Importar sequencialmente para evitar problemas de constraint
    for (let i = 0; i < body.produtos.length; i++) {
      const mlProduto = body.produtos[i]

      try {
        // Verificar se produto já existe
        const produtoExistente = await prisma.product.findUnique({
          where: { tenantId_mlListingId: { tenantId, mlListingId: mlProduto.id } }
        })

        if (produtoExistente) {
          resultados.produtos_resultado.push({
            posicao: i + 1,
            mlListingId: mlProduto.id,
            titulo: mlProduto.title,
            status: "IGNORADO",
            motivo: "Produto já existe no banco"
          })
          continue
        }

        // Criar Product
        const novoProduct = await prisma.product.create({
          data: {
            name: mlProduto.title,
            description: mlProduto.description || "",
            baseSalePrice: mlProduto.price,
            mlListingId: mlProduto.id,
            minStock: 0,
            active: true,
            tenantId
          }
        })

        // Criar Variantes
        let variantes = []

        if (mlProduto.variations && mlProduto.variations.length > 0) {
          variantes = await Promise.all(
            mlProduto.variations.map((variation: MLVariation) => {
              const atributos = variation.attribute_combinations
                ?.map(attr => attr.value)
                .join(" - ") || ""

              const variantTitle = atributos
                ? `${mlProduto.title} - ${atributos}`
                : mlProduto.title

              const cod =
                variation.user_product_id || variation.seller_sku || `ML_${mlProduto.id}_${variation.id}`

              return prisma.productVariant.create({
                data: {
                  productId: novoProduct.id,
                  tenantId,
                  cod: cod,
                  title: variantTitle,
                  salePrice: variation.price || mlProduto.price,
                  stock: variation.quantity || 0,
                  mlListingId: `${mlProduto.id}_${variation.id}`,
                  active: true
                }
              })
            })
          )
        } else {
          const variant = await prisma.productVariant.create({
            data: {
              productId: novoProduct.id,
              tenantId,
              cod: `ML_${mlProduto.id}`,
              title: mlProduto.title,
              salePrice: mlProduto.price,
              stock: mlProduto.available_quantity || 0,
              mlListingId: mlProduto.id,
              active: true
            }
          })
          variantes = [variant]
        }

        const estoque_variantes = variantes.reduce(
          (sum, v) => sum + v.stock,
          0
        )

        resultados.sucesso++
        resultados.total_variantes += variantes.length
        resultados.total_estoque += estoque_variantes

        resultados.produtos_resultado.push({
          posicao: i + 1,
          mlListingId: mlProduto.id,
          titulo: mlProduto.title,
          status: "✅ IMPORTADO",
          variantes_criadas: variantes.length,
          estoque: estoque_variantes
        })

        console.log(
          `✅ [${i + 1}/${body.produtos.length}] ${mlProduto.title} (${variantes.length} variantes)`
        )
      } catch (produtoError) {
        resultados.erro++

        const errorMsg =
          produtoError instanceof Error ? produtoError.message : "Erro desconhecido"

        resultados.produtos_resultado.push({
          posicao: i + 1,
          mlListingId: mlProduto.id,
          titulo: mlProduto.title,
          status: "❌ ERRO",
          motivo: errorMsg.substring(0, 100)
        })

        console.error(
          `❌ [${i + 1}/${body.produtos.length}] ${mlProduto.title}: ${errorMsg}`
        )
      }
    }

    return NextResponse.json({
      mensagem: `Importação em batch concluída`,
      resumo: {
        total_processado: body.produtos.length,
        total_importado: resultados.sucesso,
        total_erro: resultados.erro,
        total_variantes: resultados.total_variantes,
        total_estoque: resultados.total_estoque,
        taxa_sucesso: `${((resultados.sucesso / body.produtos.length) * 100).toFixed(1)}%`
      },
      detalhes: resultados.produtos_resultado,
      proximos_passos: [
        `✅ ${resultados.sucesso} produtos importados`,
        `📦 ${resultados.total_variantes} variantes criadas`,
        `📊 ${resultados.total_estoque} itens em estoque`,
        `🔍 Verifique em GET /api/products`
      ]
    })
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error)
    console.error("❌ Erro geral na importação batch:", error)

    return NextResponse.json(
      {
        erro: "Erro ao processar batch",
        mensagem: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    )
  }
}
