import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

/**
 * PASSO 3: Importar um produto do Mercado Livre
 * POST /api/ml/import-product
 * 
 * Body esperado: Produto com estrutura do ML
 * {
 *   id: "MLB...",
 *   title: "...",
 *   price: 100,
 *   available_quantity: 50,
 *   variations: [...]
 * }
 * 
 * Cria:
 * - 1 Product
 * - N ProductVariants (1 por variação do ML, ou 1 padrão se sem variações)
 */

interface MLVariation {
  id: string
  attribute_combinations?: Array<{ name: string; value: string }>
  price: number
  quantity: number
  seller_sku?: string
}

interface MLProduct {
  id: string
  title: string
  price: number
  available_quantity: number
  variations?: MLVariation[]
  description?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as MLProduct

    // Validar campos obrigatórios
    if (!body.id || !body.title || body.price === undefined) {
      return NextResponse.json({
        error: "Campos obrigatórios faltando",
        obrigatorios: ["id", "title", "price"]
      }, { status: 400 })
    }

    console.log("📦 Importando produto:", body.id, body.title)

    // Verificar se produto já existe
    const produtoExistente = await prisma.product.findUnique({
      where: { mlListingId: body.id }
    })

    if (produtoExistente) {
      return NextResponse.json({
        aviso: "Produto já existe no banco",
        id: produtoExistente.id,
        mlListingId: produtoExistente.mlListingId
      }, { status: 409 })
    }

    // 1️⃣ Criar o Product
    const novoProduct = await prisma.product.create({
      data: {
        name: body.title,
        description: body.description || "",
        baseSalePrice: body.price,
        mlListingId: body.id,
        minStock: 0,
        active: true
      }
    })

    console.log("✅ Product criado:", novoProduct.id)

    // 2️⃣ Criar ProductVariants
    let variantes = []

    if (body.variations && body.variations.length > 0) {
      // Se tem variações, criar uma para cada
      variantes = await Promise.all(
        body.variations.map((variation: MLVariation) => {
          // Montar título da variante (ex: "Capinha iPhone 15 Pro - Preto")
          const atributos = variation.attribute_combinations
            ?.map(attr => attr.value)
            .join(" - ") || ""
          
          const variantTitle = atributos 
            ? `${body.title} - ${atributos}`
            : body.title

          // Gerar código único (pode ser o SKU do ML ou um gerado)
          const cod = variation.seller_sku || `ML_${body.id}_${variation.id}`

          return prisma.productVariant.create({
            data: {
              productId: novoProduct.id,
              cod: cod,
              title: variantTitle,
              salePrice: variation.price || body.price,
              stock: variation.quantity || 0,
              mlListingId: `${body.id}_${variation.id}`,
              active: true
            }
          })
        })
      )
      console.log(`✅ ${variantes.length} variantes criadas`)
    } else {
      // Se não tem variações, criar 1 padrão
      const variant = await prisma.productVariant.create({
        data: {
          productId: novoProduct.id,
          cod: `ML_${body.id}`,
          title: body.title,
          salePrice: body.price,
          stock: body.available_quantity || 0,
          mlListingId: body.id,
          active: true
        }
      })
      variantes = [variant]
      console.log("✅ 1 variante padrão criada")
    }

    // 3️⃣ Buscar tudo junto para retornar
    const produtoCompleto = await prisma.product.findUnique({
      where: { id: novoProduct.id },
      include: { variants: true }
    })

    return NextResponse.json({
      sucesso: true,
      mensagem: "Produto importado com sucesso!",
      produto: {
        id: produtoCompleto?.id,
        nome: produtoCompleto?.name,
        mlListingId: produtoCompleto?.mlListingId,
        precoBase: produtoCompleto?.baseSalePrice,
        variantes: produtoCompleto?.variants.map(v => ({
          id: v.id,
          cod: v.cod,
          titulo: v.title,
          preco: v.salePrice,
          estoque: v.stock
        }))
      },
      resumo: {
        produto_criado: true,
        variantes_criadas: variantes.length,
        estoque_total: variantes.reduce((sum, v) => sum + v.stock, 0)
      },
      proximos_passos: [
        "✅ Produto importado!",
        "📝 Repita para mais produtos",
        "📊 Verifique em GET /api/products"
      ]
    })

  } catch (error) {
    console.error("❌ Erro ao importar:", error)

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
    
    // Checar se é erro de constraint unique (cod duplicado)
    if (errorMessage.includes("Unique constraint")) {
      return NextResponse.json({
        erro: "Código (cod) duplicado",
        mensagem: "Este produto ou variante já existe",
        detalhe: errorMessage
      }, { status: 409 })
    }

    return NextResponse.json({
      erro: "Erro ao importar produto",
      mensagem: errorMessage
    }, { status: 500 })
  }
}
