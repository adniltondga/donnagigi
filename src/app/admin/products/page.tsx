'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/calculations'
import ProductFormDialog from '@/components/ProductFormDialog'
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
  baseImage?: string
  categoryId?: string | null
  category?: { id: string; name: string; icon?: string } | null
  supplier?: string | null
  mlListingId?: string | null
  shopeeListingId?: string | null
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
  const [variantFormData, setVariantFormData] = useState({
    salePrice: 0,
    purchaseCost: 0,
    boxCost: 0,
    stock: 0,
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
    fetchProducts()
  }

  function handleEditVariant(variant: any) {
    setEditingVariant(variant)
    setVariantFormData({
      salePrice: variant.salePrice || 0,
      purchaseCost: variant.purchaseCost || 0,
      boxCost: variant.boxCost || 0,
      stock: variant.stock || 0,
    })
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

    try {
      const response = await fetch(
        `/api/products/${selectedProduct.id}/variants/${editingVariant.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            salePrice: variantFormData.salePrice,
            purchaseCost: variantFormData.purchaseCost,
            boxCost: variantFormData.boxCost,
            stock: variantFormData.stock,
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
        ) : (() => {
          const filteredProducts = products.filter((product) => {
            const searchLower = searchTerm.toLowerCase()
            return (
              product.name.toLowerCase().includes(searchLower) ||
              (product.mlListingId && product.mlListingId.toLowerCase().includes(searchLower)) ||
              (product.shopeeListingId && product.shopeeListingId.toLowerCase().includes(searchLower))
            )
          })

          if (filteredProducts.length === 0) {
            return (
              <div className="p-6 text-center text-gray-500">
                {searchTerm ? 'Nenhum produto encontrado com esses critérios' : 'Nenhum produto cadastrado'}
              </div>
            )
          }

          return (
          <div className="divide-y">
            {filteredProducts.map((product) => {
              const productStock = product.variants?.reduce((s, v) => s + (v.stock || 0), 0) || 0
              const priceMin = product.variants?.length ? Math.min(...product.variants.map(v => v.salePrice || 0)) : 0
              const priceMax = product.variants?.length ? Math.max(...product.variants.map(v => v.salePrice || 0)) : 0
              const productRevenue = product.variants?.reduce((s, v) => s + (v.salePrice || 0) * (v.stock || 0), 0) || 0
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
                          {product.baseImage ? (
                            <img
                              src={product.baseImage}
                              alt={product.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-gray-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {product.category && (
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                                {product.category.icon ? `${product.category.icon} ` : ''}
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

                      {/* Receita */}
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Receita</div>
                        <div className="text-lg font-bold text-green-600">
                          {formatCurrency(productRevenue)}
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

                            <div className="grid gap-2">
                          {product.variants.map((variant) => {
                            const unitCost = (variant.purchaseCost || 0) + (variant.boxCost || 0)
                            const margin = variant.salePrice - unitCost
                            const variantRevenue = variant.salePrice * variant.stock
                            const marginPercent = variant.salePrice > 0 ? (margin / variant.salePrice) * 100 : 0

                            // Formatar variação
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
                                    {formatCurrency(variant.salePrice)}
                                  </div>
                                </div>

                                {/* Custo */}
                                <div>
                                  <div className="text-xs text-gray-500">Custo</div>
                                  <div className="text-sm text-gray-700">
                                    {formatCurrency(unitCost)}
                                  </div>
                                </div>

                                {/* Margem */}
                                <div>
                                  <div className="text-xs text-gray-500">Margem</div>
                                  <div className="font-semibold text-sm text-green-600">
                                    {formatCurrency(margin)}
                                  </div>
                                  <div className="text-xs text-gray-500">{marginPercent.toFixed(1)}%</div>
                                </div>

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
                                <div className="hidden lg:flex lg:flex-col">
                                  <div className="text-xs text-gray-500">Receita</div>
                                  <div className="font-semibold text-sm text-green-600">
                                    {formatCurrency(variantRevenue)}
                                  </div>
                                </div>

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
          )
        })()}
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
                <label className="block text-sm font-medium mb-1">Preço de Venda (R$)</label>
                <input
                  type="number"
                  value={variantFormData.salePrice}
                  onChange={(e) =>
                    setVariantFormData({ ...variantFormData, salePrice: parseFloat(e.target.value) })
                  }
                  step="0.01"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Custo de Compra (R$)</label>
                <input
                  type="number"
                  value={variantFormData.purchaseCost}
                  onChange={(e) =>
                    setVariantFormData({ ...variantFormData, purchaseCost: parseFloat(e.target.value) })
                  }
                  step="0.01"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Custo da Caixa (R$)</label>
                <input
                  type="number"
                  value={variantFormData.boxCost}
                  onChange={(e) =>
                    setVariantFormData({ ...variantFormData, boxCost: parseFloat(e.target.value) })
                  }
                  step="0.01"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Estoque</label>
                <input
                  type="number"
                  value={variantFormData.stock}
                  onChange={(e) =>
                    setVariantFormData({ ...variantFormData, stock: parseInt(e.target.value) })
                  }
                  className="w-full border rounded px-3 py-2"
                />
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
    </div>
  )
}
