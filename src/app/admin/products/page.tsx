'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/calculations'
import ProductFormDialog from '@/components/ProductFormDialog'
import ImageUploadVariant from '@/components/ImageUploadVariant'
import CurrencyInput from '@/components/CurrencyInput'
import { ChevronDown, ChevronRight, Edit2, Trash2, Package, Search, X } from 'lucide-react'

interface ProductVariant {
  id: string
  cod: string
  modelId?: string | null
  colorId?: string | null
  model?: { id: string; name: string } | null
  color?: { id: string; name: string; hexColor: string } | null
  salePrice: number
  purchaseCost?: number
  boxCost?: number
  stock: number
  active: boolean
}

interface Product {
  id: string
  name: string
  description?: string
  categoryId?: string | null
  category?: { id: string; name: string; icon?: string } | null
  supplier?: string | null
  mlListingId?: string | null
  shopeeListingId?: string | null
  baseSalePrice?: number | null
  basePurchaseCost?: number | null
  baseBoxCost?: number | null
  baseMLTariff?: number | null
  baseDeliveryTariff?: number | null
  baseMLPrice?: number | null
  shopeePrice?: number | null
  active: boolean
  variants?: ProductVariant[]
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingVariant, setEditingVariant] = useState<any | null>(null)
  const [showVariantForm, setShowVariantForm] = useState(false)
  const [showImageUpload, setShowImageUpload] = useState<string | null>(null)
  const [variantFormData, setVariantFormData] = useState({
    stock: 0,
    salePrice: 0,
    purchaseCost: 0,
    boxCost: 0,
    mlTariff: 0, // Sempre do produto (baseMLTariff)
    deliveryTariff: 0, // Sempre do produto (baseDeliveryTariff)
    shoppeeTariff: 0, // Sempre do produto (baseShoppeeTariff)
    shopeeDeliveryTariff: 0, // Sempre do produto (baseShopeeDeliveryTariff)
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/products')
      const data = await response.json()
      if (data.success) {
        setProducts(data.data || [])
      } else {
        setError(data.error || 'Erro ao carregar produtos')
      }
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
      setError('Erro ao conectar com a API')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja deletar este produto?')) return

    try {
      setDeleting(id)
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setProducts(products.filter((p) => p.id !== id))
        alert('Produto deletado com sucesso!')
      } else {
        alert(data.error || 'Erro ao deletar produto')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao deletar produto')
    } finally {
      setDeleting(null)
    }
  }

  function handleEdit(product: Product) {
    setSelectedProduct(product)
    setShowForm(true)
  }

  function handleCreate() {
    setSelectedProduct(null)
    setShowForm(true)
  }

  function handleFormClose() {
    setShowForm(false)
    setSelectedProduct(null)
    // Recarregar lista quando produto é criado/editado
    fetchProducts()
  }

  async function handleEditVariant(variant: any) {
    setEditingVariant(variant)
    
    // Buscar produto atualizado da API para garantir todos os campos
    if (selectedProduct?.id) {
      try {
        const response = await fetch(`/api/products/${selectedProduct.id}`)
        const data = await response.json()
        
        if (data.success && data.data) {
          const product = data.data
          console.log('✅ Produto carregado da API:', product)
          
          setVariantFormData({
            stock: variant.stock || 0,
            salePrice: variant.salePrice || product.baseSalePrice || 0,
            purchaseCost: variant.purchaseCost || product.basePurchaseCost || 0,
            boxCost: variant.boxCost || product.baseBoxCost || 0,
            mlTariff: product.baseMLTariff || 0,
            deliveryTariff: product.baseDeliveryTariff || 0,
            shoppeeTariff: product.baseShoppeeTariff || 0,
            shopeeDeliveryTariff: product.baseShopeeDeliveryTariff || 0,
          })
        }
      } catch (error) {
        console.error('❌ Erro ao carregar produto:', error)
      }
    }
    
    setShowVariantForm(true)
  }

  async function handleDeleteVariant(productId: string, variantId: string) {
    if (!confirm('Tem certeza que deseja deletar esta variação?')) return

    try {
      const response = await fetch(`/api/products/${productId}/variants/${variantId}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        alert('Variação deletada com sucesso!')
        fetchProducts()
      } else {
        alert(data.error || 'Erro ao deletar variação')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao deletar variação')
    }
  }

  async function handleSaveVariant() {
    if (!editingVariant || !selectedProduct) return

    console.log('💾 Salvando variação:', {
      variantId: editingVariant.id,
      salePrice: variantFormData.salePrice,
      stock: variantFormData.stock,
    })

    try {
      const response = await fetch(
        `/api/products/${selectedProduct.id}/variants/${editingVariant.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stock: variantFormData.stock,
            salePrice: variantFormData.salePrice,
          }),
        }
      )

      const data = await response.json()

      if (response.ok && data.success) {
        alert('Variação atualizada com sucesso!')
        setShowVariantForm(false)
        setEditingVariant(null)
        fetchProducts()
      } else {
        alert(data.error || 'Erro ao atualizar variação')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao atualizar variação')
    }
  }

  // Função para calcular custo total baseado em marketplace
  function calculateVariantCost(variant: any, product: any, marketplace: 'ml' | 'shopee' = 'ml') {
    // Custo de compra: variante ou padrão do produto
    const purchaseCost = (variant.purchaseCost ?? 0) > 0 ? variant.purchaseCost : (product?.basePurchaseCost || 0)
    
    // Caixa: variante ou padrão do produto
    const boxCost = (variant.boxCost ?? 0) > 0 ? variant.boxCost : (product?.baseBoxCost || 0)

    if (marketplace === 'ml') {
      // Tarifas: SEMPRE do padrão do produto
      const mlTariff = product?.baseMLTariff || 0
      const deliveryTariff = product?.baseDeliveryTariff || 0
      return purchaseCost + boxCost + mlTariff + deliveryTariff
    } else {
      // Tarifas: SEMPRE do padrão do produto
      const shoppeeTariff = product?.baseShoppeeTariff || 0
      const shopeeDeliveryTariff = product?.baseShopeeDeliveryTariff || 0
      return purchaseCost + boxCost + shoppeeTariff + shopeeDeliveryTariff
    }
  }

  // Cálculos com base em variações
  const totalStockQuantity = products.reduce(
    (sum, p) => sum + (p.variants?.reduce((vs, v) => vs + (v.stock || 0), 0) || 0),
    0
  )

  const totalRevenue = products.reduce((sum, p) => {
    return (
      sum +
      (p.variants?.reduce((vs, v) => vs + (v.salePrice || 0) * (v.stock || 0), 0) || 0)
    )
  }, 0)

  const totalCost = products.reduce((sum, p) => {
    return (
      sum +
      (p.variants?.reduce((vs, v) => {
        const unitCost = (v.purchaseCost || 0) + (v.boxCost || 0)
        return vs + unitCost * (v.stock || 0)
      }, 0) || 0)
    )
  }, 0)

  // Filtrar produtos
  const filteredProducts = products.filter((product) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      product.name.toLowerCase().includes(searchLower) ||
      (product.mlListingId && product.mlListingId.toLowerCase().includes(searchLower)) ||
      (product.shopeeListingId && product.shopeeListingId.toLowerCase().includes(searchLower))
    )
  })

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
        <p className="text-gray-500">Gerencie seu catálogo de capinhas</p>
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
          <Button size="sm" onClick={fetchProducts} className="mt-2">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Pesquisa */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar por nome do produto, código ML ou código Shopee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Total de Produtos</p>
          <p className="text-2xl font-bold">{products.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Estoque Total</p>
          <p className="text-2xl font-bold">{totalStockQuantity}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Receita Total</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Custo Total</p>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(totalCost)}
          </p>
        </div>
      </div>

      {/* Novo Produto */}
      <div>
        <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
          + Novo Produto
        </Button>
      </div>

      {/* Tabela com Produtos e Variações */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-6 text-center">Carregando produtos...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {searchTerm ? 'Nenhum produto encontrado com esses critérios' : 'Nenhum produto cadastrado'}
          </div>
        ) : (
          <div className="divide-y">
            {filteredProducts.map((product) => {
              const productStock = product.variants?.reduce((s, v) => s + (v.stock || 0), 0) || 0
              const getPriceForVariant = (variant: any) => variant.salePrice && variant.salePrice > 0 ? variant.salePrice : (product.baseSalePrice || 0)
              const priceMin = product.variants?.length ? Math.min(...product.variants.map(getPriceForVariant)) : (product.baseSalePrice || 0)
              const priceMax = product.variants?.length ? Math.max(...product.variants.map(getPriceForVariant)) : (product.baseSalePrice || 0)
              const productRevenue = product.variants?.reduce((s, v) => s + (getPriceForVariant(v)) * (v.stock || 0), 0) || 0
              const isExpanded = expandedProduct === product.id
              const variantCount = product.variants?.length || 0

              return (
                <div key={product.id}>
                  {/* HEADER DO PRODUTO */}
                  <div
                    onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Botão expandir */}
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>

                      {/* Imagem + Info do Produto */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {product.category && (
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                                {product.category.name}
                              </span>
                            )}
                            {product.mlListingId && (
                              <span className="text-xs bg-yellow-100 px-2 py-1 rounded text-yellow-700 font-mono">
                                ML: {product.mlListingId}
                              </span>
                            )}
                            {product.shopeeListingId && (
                              <span className="text-xs bg-red-100 px-2 py-1 rounded text-red-700 font-mono">
                                SP: {product.shopeeListingId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* STATS DO PRODUTO */}
                    <div className="flex items-center gap-8 ml-4">
                      {/* Variações */}
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Variações</div>
                        <div className="text-lg font-bold text-blue-600">{variantCount}</div>
                      </div>

                      {/* Estoque */}
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Estoque</div>
                        <div
                          className={`text-lg font-bold ${
                            productStock === 0 ? 'text-red-600' : 'text-gray-900'
                          }`}
                        >
                          {productStock}
                        </div>
                      </div>

                      {/* Preço */}
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Preço</div>
                        <div className="text-lg font-bold text-gray-900">
                          {priceMin === priceMax ? (
                            formatCurrency(priceMin)
                          ) : (
                            <div className="flex flex-col items-end">
                              <span>{formatCurrency(priceMin)}</span>
                              <span className="text-xs text-gray-500">a {formatCurrency(priceMax)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(product)
                          }}
                          disabled={deleting === product.id}
                          className="gap-1"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Editar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(product.id)
                          }}
                          disabled={deleting === product.id}
                          className="gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">
                            {deleting === product.id ? 'Deletando...' : 'Deletar'}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* DETALHE DAS VARIAÇÕES */}
                  {isExpanded && product.variants && product.variants.length > 0 && (
                    <div className="bg-gray-50 border-t">
                      <div className="px-6 py-4">
                        <h4 className="font-semibold text-gray-900 mb-3">
                          Variações ({product.variants.length})
                        </h4>

                        <div className="space-y-2">
                          {product.variants.map((variant) => {
                            const salePrice = variant.salePrice || 0

                            const variantName = variant.model && variant.color
                              ? `${variant.model.name} - ${variant.color.name}`
                              : variant.cod

                            return (
                              <div
                                key={variant.id}
                                className="bg-white border rounded p-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 items-center"
                              >
                                {/* Variação (Modelo - Cor) */}
                                <div className="sm:col-span-1 lg:col-span-2">
                                  <div className="text-xs text-gray-500">Variação</div>
                                  <div className="text-sm font-medium text-gray-700 truncate">
                                    {variantName}
                                  </div>
                                  <div className="text-xs text-gray-400">{variant.cod}</div>
                                </div>

                                {/* Preço */}
                                <div>
                                  <div className="text-xs text-gray-500">Preço</div>
                                  <div className="font-semibold text-sm">
                                    {formatCurrency(salePrice)}
                                  </div>
                                </div>

                                {/* Receita Líquida */}
                                <div className="sm:col-span-2 lg:col-span-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <p className="text-xs text-gray-600 mb-1">Mercado Livre</p>
                                      <p className={`text-sm font-bold ${salePrice - calculateVariantCost(variant, product, 'ml') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(salePrice - calculateVariantCost(variant, product, 'ml'))}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {salePrice > 0 ? ((salePrice - calculateVariantCost(variant, product, 'ml')) / salePrice * 100).toFixed(1) : '0'}% de margem
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-600 mb-1">Shopee</p>
                                      <p className={`text-sm font-bold ${salePrice - calculateVariantCost(variant, product, 'shopee') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(salePrice - calculateVariantCost(variant, product, 'shopee'))}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {salePrice > 0 ? ((salePrice - calculateVariantCost(variant, product, 'shopee')) / salePrice * 100).toFixed(1) : '0'}% de margem
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Custo */}
                                {/* Removido */}

                                {/* Margem */}
                                {/* Removido */}

                                {/* Estoque */}
                                <div>
                                  <div className="text-xs text-gray-500">Estoque</div>
                                  <div
                                    className={`font-semibold text-sm ${
                                      variant.stock === 0 ? 'text-red-600' : 'text-gray-900'
                                    }`}
                                  >
                                    {variant.stock}
                                  </div>
                                </div>

                                {/* Receita */}
                                {/* Removido */}

                                {/* Ações */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedProduct(product)
                                      handleEditVariant(variant)
                                    }}
                                    className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition"
                                  >
                                    ✏️ Editar
                                  </button>
                                  <button
                                    onClick={() => setShowImageUpload(showImageUpload === variant.id ? null : variant.id)}
                                    className="px-2 py-1 text-xs bg-green-100 text-green-600 rounded hover:bg-green-200 transition"
                                    title="Gerenciar imagens desta variação"
                                  >
                                    📸 Imagens
                                  </button>
                                  <button
                                    onClick={() => handleDeleteVariant(product.id, variant.id)}
                                    className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                                  >
                                    🗑️ Deletar
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Formulário */}
      {showForm && (
        <ProductFormDialog
          product={selectedProduct}
          onClose={handleFormClose}
        />
      )}

      {/* Modal de Edição de Variação */}
      {showVariantForm && editingVariant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold mb-4">Editar Variação</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Preço Venda (R$)</label>
                <CurrencyInput
                  value={variantFormData.salePrice}
                  onChange={(value) =>
                    setVariantFormData({ ...variantFormData, salePrice: value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estoque</label>
                <input
                  type="number"
                  value={variantFormData.stock}
                  onChange={(e) =>
                    setVariantFormData({ ...variantFormData, stock: parseInt(e.target.value) || 0 })
                  }
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Custo Total Calculado - Somente Visualização */}
              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <p className="text-xs text-gray-600 mb-1">💰 Custo Total Calculado (Mercado Livre)</p>
                <div className="text-xs text-gray-500 mb-2 text-justify">
                  ℹ️ {editingVariant?.purchaseCost !== undefined && editingVariant.purchaseCost !== null ? '(Valores específicos da variação)' : '(Usando tarifas padrão do produto)'}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2 text-xs text-gray-600">
                  <div>Custo: R$ {(variantFormData.purchaseCost || 0).toFixed(2)}</div>
                  <div>Embalagem: R$ {(variantFormData.boxCost || 0).toFixed(2)}</div>
                  <div>Tarifa ML: R$ {(variantFormData.mlTariff || 0).toFixed(2)}</div>
                  <div>Entrega ML: R$ {(variantFormData.deliveryTariff || 0).toFixed(2)}</div>
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  R$ {(
                    (variantFormData.purchaseCost || 0) +
                    (variantFormData.boxCost || 0) +
                    (variantFormData.mlTariff || 0) +
                    (variantFormData.deliveryTariff || 0)
                  ).toFixed(2)}
                </p>
              </div>

              <div className="bg-red-50 p-3 rounded border border-red-200">
                <p className="text-xs text-gray-600 mb-1">💰 Custo Total Calculado (Shopee)</p>
                <div className="text-xs text-gray-500 mb-2">
                  ℹ️ {editingVariant?.shoppeeTariff !== undefined && editingVariant.shoppeeTariff !== null ? '(Valores específicos da variação)' : '(Usando tarifas padrão do produto)'}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2 text-xs text-gray-600">
                  <div>Custo: R$ {(variantFormData.purchaseCost || 0).toFixed(2)}</div>
                  <div>Embalagem: R$ {(variantFormData.boxCost || 0).toFixed(2)}</div>
                  <div>Tarifa Shopee: R$ {(variantFormData.shoppeeTariff || 0).toFixed(2)}</div>
                  <div>Entrega: R$ {(variantFormData.shopeeDeliveryTariff || 0).toFixed(2)}</div>
                </div>
                <p className="text-2xl font-bold text-red-700">
                  R$ {(
                    (variantFormData.purchaseCost || 0) +
                    (variantFormData.boxCost || 0) +
                    (variantFormData.shoppeeTariff || 0) +
                    (variantFormData.shopeeDeliveryTariff || 0)
                  ).toFixed(2)}
                </p>
              </div>

              {/* Receita Líquida */}
              <div className="bg-green-50 p-4 rounded border-2 border-green-300">
                <p className="text-sm font-semibold mb-3 text-green-900">💵 Receita Líquida por Venda</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-green-700 mb-1">Mercado Livre</p>
                    <p className="text-xl font-bold text-green-700">
                      R$ {(
                        variantFormData.salePrice -
                        ((variantFormData.purchaseCost || 0) +
                          (variantFormData.boxCost || 0) +
                          (variantFormData.mlTariff || 0) +
                          (variantFormData.deliveryTariff || 0))
                      ).toFixed(2)}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {variantFormData.salePrice > 0 ? (
                        ((
                          variantFormData.salePrice -
                          ((variantFormData.purchaseCost || 0) +
                            (variantFormData.boxCost || 0) +
                            (variantFormData.mlTariff || 0) +
                            (variantFormData.deliveryTariff || 0))
                        ) / variantFormData.salePrice * 100).toFixed(1)
                      ) : (
                        0
                      )}% de margem
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-red-700 mb-1">Shopee</p>
                    <p className="text-xl font-bold text-red-700">
                      R$ {(
                        variantFormData.salePrice -
                        ((variantFormData.purchaseCost || 0) +
                          (variantFormData.boxCost || 0) +
                          (variantFormData.shoppeeTariff || 0) +
                          (variantFormData.shopeeDeliveryTariff || 0))
                      ).toFixed(2)}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      {variantFormData.salePrice > 0 ? (
                        ((
                          variantFormData.salePrice -
                          ((variantFormData.purchaseCost || 0) +
                            (variantFormData.boxCost || 0) +
                            (variantFormData.shoppeeTariff || 0) +
                            (variantFormData.shopeeDeliveryTariff || 0))
                        ) / variantFormData.salePrice * 100).toFixed(1)
                      ) : (
                        0
                      )}% de margem
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowVariantForm(false)
                  setEditingVariant(null)
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveVariant}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Upload de Imagens */}
      {showImageUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Gerenciar Imagens da Variação</h2>
              <button
                onClick={() => setShowImageUpload(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            {showImageUpload && filteredProducts.find(p => p.variants?.find(v => v.id === showImageUpload)) && (
              <ImageUploadVariant
                variantId={showImageUpload}
                productId={filteredProducts.find(p => p.variants?.find(v => v.id === showImageUpload))?.id || ''}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
