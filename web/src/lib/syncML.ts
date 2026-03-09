import { PrismaClient } from "@prisma/client"
import { MercadoLivreAPI } from "@/lib/mercadolivre"

const prisma = new PrismaClient()

export async function syncProductToML(
  productId: string,
  accessToken: string,
  sellerId: string
) {
  try {
    // Buscar produto
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      throw new Error("Produto não encontrado")
    }

    // Inicializar API do ML
    const mlAPI = new MercadoLivreAPI(accessToken, sellerId)

    // Verificar se já existe sincronização
    const mlIntegration = await prisma.mLIntegration.findFirst()
    if (!mlIntegration) {
      throw new Error("Integração com Mercado Livre não configurada")
    }

    const existingSync = await prisma.mLProduct.findFirst({
      where: {
        productId,
        mlIntegrationId: mlIntegration.id,
      },
    })

    const categoryMap: Record<string, string> = {
      "capinhas": "MLB100672", // Categoria de acessórios de celular
      "default": "MLB100672",
    }

    const mlData = {
      title: product.name,
      price: product.salePrice,
      description: product.description,
      pictures: [product.image],
      category_id: categoryMap[product.category.toLowerCase()] || categoryMap["default"],
      quantity: product.stock,
    }

    let mlListingId: string
    if (existingSync?.mlListingID) {
      // Atualizar listing existente
      const updated = await mlAPI.updateListing(
        existingSync.mlListingID,
        mlData
      )
      mlListingId = updated.id
      await prisma.mLProduct.update({
        where: { id: existingSync.id },
        data: {
          syncStatus: "synced",
          lastSyncedAt: new Date(),
          syncError: null,
        },
      })
    } else {
      // Criar novo listing
      const created = await mlAPI.createListing(mlData)
      mlListingId = created.id

      await prisma.mLProduct.create({
        data: {
          productId,
          mlListingID: mlListingId,
          mlIntegrationId: mlIntegration.id,
          syncStatus: "synced",
        },
      })
    }

    return {
      success: true,
      mlListingId,
      message: "Produto sincronizado com Mercado Livre",
    }
  } catch (error) {
    console.error("Erro ao sincronizar produto:", error)

    // Registrar erro no banco
    const mlIntegration = await prisma.mLIntegration.findFirst()
    if (mlIntegration) {
      const existingSync = await prisma.mLProduct.findFirst({
        where: {
          productId,
          mlIntegrationId: mlIntegration.id,
        },
      })

      if (existingSync) {
        await prisma.mLProduct.update({
          where: { id: existingSync.id },
          data: {
            syncStatus: "failed",
            syncError: error instanceof Error ? error.message : "Erro desconhecido",
          },
        })
      }
    }

    throw error
  }
}

export async function syncAllProductsToML(
  accessToken: string,
  sellerId: string
) {
  try {
    const products = await prisma.product.findMany()
    const results = []

    for (const product of products) {
      try {
        const result = await syncProductToML(product.id, accessToken, sellerId)
        results.push({ productId: product.id, ...result })
      } catch (error) {
        results.push({
          productId: product.id,
          success: false,
          error: error instanceof Error ? error.message : "Erro desconhecido",
        })
      }
    }

    return results
  } catch (error) {
    console.error("Erro ao sincronizar todos os produtos:", error)
    throw error
  }
}
