// Integração com API do Mercado Livre
const ML_API_BASE = "https://api.mercadolibre.com"

export interface MLProductData {
  title: string
  price: number
  description: string
  pictures: string[]
  category_id: string
  quantity: number
  attributes?: Record<string, string>
  cod?: string
}

// Para variações de produtos
export interface VariantMLData extends MLProductData {
  variantId: string
  variantName: string // Ex: "Preto - iPhone 14 Pro Max"
  attributeValues: Record<string, string>
}

export class MercadoLivreAPI {
  private accessToken: string

  constructor(accessToken: string, _sellerId: string) {
    this.accessToken = accessToken
    // sellerId pode ser usado em operações futuras
  }

  // Criar listing no Mercado Livre
  async createListing(productData: MLProductData) {
    try {
      const response = await fetch(`${ML_API_BASE}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          title: productData.title,
          category_id: productData.category_id,
          price: productData.price,
          currency_id: "BRL",
          available_quantity: productData.quantity,
          buying_mode: "buy_it_now",
          condition: "new",
          description: {
            plain_text: productData.description,
          },
          pictures: productData.pictures.map((url) => ({
            source: url,
          })),
          attributes: productData.attributes,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`ML API Error: ${error.message}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Erro ao criar listing no Mercado Livre:", error)
      throw error
    }
  }

  // Atualizar listing
  async updateListing(listingId: string, productData: Partial<MLProductData>) {
    try {
      const updateData: Record<string, any> = {}

      if (productData.title) updateData.title = productData.title
      if (productData.price) updateData.price = productData.price
      if (productData.quantity)
        updateData.available_quantity = productData.quantity
      if (productData.description) {
        updateData.description = {
          plain_text: productData.description,
        }
      }

      const response = await fetch(`${ML_API_BASE}/items/${listingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`ML API Error: ${error.message}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Erro ao atualizar listing no Mercado Livre:", error)
      throw error
    }
  }

  // Deletar listing
  async deleteListing(listingId: string) {
    try {
      const response = await fetch(`${ML_API_BASE}/items/${listingId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`ML API Error: ${error.message}`)
      }

      return { success: true }
    } catch (error) {
      console.error("Erro ao deletar listing no Mercado Livre:", error)
      throw error
    }
  }

  // Obter info de categoria
  async getCategories() {
    try {
      const response = await fetch(`${ML_API_BASE}/sites/MLB/categories`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })

      if (!response.ok) {
        throw new Error("Erro ao buscar categorias")
      }

      return await response.json()
    } catch (error) {
      console.error("Erro ao buscar categorias:", error)
      throw error
    }
  }

  // Criar listing para uma variação de produto
  async createVariantListing(variantData: VariantMLData) {
    try {
      // Título com informações da variação
      const fullTitle = `${variantData.title} - ${variantData.variantName}`

      const response = await fetch(`${ML_API_BASE}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          title: fullTitle.substring(0, 250), // ML tem limite
          category_id: variantData.category_id,
          price: variantData.price,
          currency_id: "BRL",
          available_quantity: variantData.quantity,
          buying_mode: "buy_it_now",
          condition: "new",
          description: {
            plain_text: variantData.description,
          },
          pictures: variantData.pictures.map((url) => ({
            source: url,
          })),
          attributes: this.buildMLAttributes(variantData.attributeValues),
          sku: variantData.cod, // COD (código) da variação
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`ML API Error: ${error.message}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Erro ao criar listing de variação no Mercado Livre:", error)
      throw error
    }
  }

  // Construir atributos no formato esperado pelo ML
  private buildMLAttributes(
    variantAttributes: Record<string, string>
  ): Record<string, string> {
    // Mapear atributos customizados para formatos conhecidos no ML
    const mlAttributes: Record<string, string> = {}

    for (const [key, value] of Object.entries(variantAttributes)) {
      const lowerKey = key.toLowerCase()

      if (lowerKey.includes("cor") || lowerKey.includes("color")) {
        mlAttributes["COLOR"] = value
      } else if (
        lowerKey.includes("modelo") ||
        lowerKey.includes("iphone") ||
        lowerKey.includes("model")
      ) {
        mlAttributes["MODEL"] = value
      }
    }

    return mlAttributes
  }
}
