/**
 * Função compartilhada para sincronização automática com ML
 * Usada por webhook e polling
 */

import { PrismaClient } from '@prisma/client'
import { getDefaultTenantId } from './tenant'

const prisma = new PrismaClient()

export interface MLProductResult {
  id: string
  title: string
  status: string
  price: number
  available_quantity: number
  variations?: Array<{
    id: string
    attribute_combinations?: Array<{
      name: string
      value_name: string
    }>
    price?: number
    available_quantity?: number
  }>
  pictures?: Array<{ url: string }>
  description?: string
}

/**
 * Sincroniza um produto do ML para o banco
 */
export async function syncMLProductToDB(
  mlProduct: MLProductResult
) {
  try {
    // Verificar se já existe
    let product = await prisma.product.findFirst({
      where: { mlListingId: mlProduct.id },
    })

    const productData = {
      name: mlProduct.title || 'Produto ML',
      mlListingId: mlProduct.id,
      active: mlProduct.status === 'active',
      baseSalePrice: mlProduct.price,
      description: mlProduct.description || '',
    }

    if (product) {
      // Atualizar status e preço
      product = await prisma.product.update({
        where: { id: product.id },
        data: productData,
      })
    } else {
      // Criar novo
      const tenantId = await getDefaultTenantId()
      product = await prisma.product.create({
        data: { ...productData, tenantId },
      })
    }

    // Sincronizar variações se existirem
    if (mlProduct.variations && mlProduct.variations.length > 0) {
      await syncMLVariants(product.id, mlProduct.variations)
    }

    return {
      success: true,
      productId: product.id,
      message: product ? 'Produto atualizado' : 'Produto criado',
    }
  } catch (error) {
    console.error('[AUTO-SYNC] Erro ao sincronizar produto:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

/**
 * Sincroniza variações de um produto
 */
async function syncMLVariants(
  productId: string,
  variations: Array<{
    id: string
    attribute_combinations?: Array<{
      name: string
      value_name: string
    }>
    price?: number
    available_quantity?: number
  }>
) {
  try {
    for (const variant of variations) {
      const variantName = variant.attribute_combinations
        ?.map((ac) => `${ac.name}: ${ac.value_name}`)
        .join(' | ')

      await prisma.productVariant.upsert({
        where: { cod: variant.id },
        create: {
          productId,
          cod: variant.id,
          title: variantName || `Variação ${variant.id}`,
          salePrice: variant.price || 0,
          stock: variant.available_quantity || 0,
          active: true,
        },
        update: {
          salePrice: variant.price || 0,
          stock: variant.available_quantity || 0,
        },
      })
    }
  } catch (error) {
    console.error('[AUTO-SYNC] Erro ao sincronizar variações:', error)
  }
}

/**
 * Busca todos os produtos do ML e sincroniza
 */
export async function syncAllMLProducts(token: string, sellerId: string) {
  try {
    console.log('[AUTO-SYNC] Iniciando sincronização completa...')

    // Buscar todos os produtos do usuário no ML
    const response = await fetch(
      `https://api.mercadolibre.com/users/${sellerId}/items/search?limit=200`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (!response.ok) {
      throw new Error(`Erro ao buscar produtos: ${response.statusText}`)
    }

    const itemIds: string[] = await response.json()
    console.log(`[AUTO-SYNC] Encontrados ${itemIds.length} produtos no ML`)

    let synced = 0
    let failed = 0

    // Sincronizar cada produto
    for (const itemId of itemIds) {
      try {
        const itemResponse = await fetch(
          `https://api.mercadolibre.com/items/${itemId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )

        if (!itemResponse.ok) continue

        const mlProduct = await itemResponse.json() as MLProductResult
        const result = await syncMLProductToDB(mlProduct)

        if (result.success) {
          synced++
        } else {
          failed++
        }
      } catch (error) {
        console.error(`[AUTO-SYNC] Erro ao sincronizar ${itemId}:`, error)
        failed++
      }

      // Aguardar um pouco para não sobrecarregar a API
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    console.log(
      `[AUTO-SYNC] Sincronização completa: ${synced} sucesso, ${failed} falhas`
    )

    return {
      success: true,
      total: itemIds.length,
      synced,
      failed,
    }
  } catch (error) {
    console.error('[AUTO-SYNC] Erro na sincronização:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}
