'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/calculations'
import ProductFormDialog from '@/components/ProductFormDialog'
import ImageUploadVariant from '@/components/ImageUploadVariant'
import CurrencyInput from '@/components/CurrencyInput'
import { ChevronDown, ChevronRight, Edit2, Trash2, Package, Search, X } from 'lucide-react'

interface ProductVariant {
  id: string
  cod: string
  title?: string
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
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [totalActive, setTotalActive] = useState(0)
  const [totalInactive, setTotalInactive] = useState(0)
  const [allProducts, setAllProducts] = useState<Product[]>([])

  function parseVariantTitle(title?: string) {
    if (!title) return null
    const parts: Record<string, string> = {}
    const regex = /([^:,]+):([^,]+)/g
    let match
    while ((match = regex.exec(title)) !== null) {
      const key = match[1].trim().toLowerCase()
      const value = match[2].trim()
      parts[key] = value
    }
    return Object.keys(parts).length > 0 ? parts : null
  }

  function extractMLCode(mlListingId?: string) {
    if (!mlListingId) return ''
    // Remove "MLB" prefix if exists
    return mlListingId.replace(/^MLB/, '')
  }

  async function copyToClipboard(text: string | undefined) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      alert('Código copiado!')
    } catch (err) {
      console.error('Erro ao copiar:', err)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [currentPage, itemsPerPage])

  // Quando filtro de status muda, carregar todos os produtos e resetar página
  useEffect(() => {
    setCurrentPage(1)
    fetchAllProductsForFilter()
  }, [statusFilter])

  async function fetchAllProductsForFilter() {
    try {
      setLoading(true)
      setError(null)
      
      // Buscar TODOS os produtos (sem paginação)
      const response = await fetch(`/api/products?limit=1000`)
      const data = await response.json()
      
      if (data.success) {
        const allProds = data.data || []
        setAllProducts(allProds)
        
        // Contar ativos e inativos
        const active = allProds.filter((p: Product) => p.active).length
        const inactive = allProds.filter((p: Product) => !p.active).length
        setTotalActive(active)
        setTotalInactive(inactive)
        
        // Filtrar conforme status
        const filtered = allProds.filter((product: Product) => {
          if (statusFilter === 'all') return true
          if (statusFilter === 'active') return product.active
          if (statusFilter === 'inactive') return !product.active
          return true
        })
        
        // Paginar os filtrados
        setTotalItems(filtered.length)
        setTotalPages(Math.ceil(filtered.length / itemsPerPage))
        
        // Pegar apenas a página 1
        const paginatedProducts = filtered.slice(0, itemsPerPage)
        setProducts(paginatedProducts)
      } else {
        setError(data.error || 'Erro ao carregar produtos')
      }
    } catch (error) {
      console.error('Erro ao filtrar produtos:', error)
      setError('Erro ao connect com API')
    } finally {
      setLoading(false)
    }
  }

  async function fetchProducts() {
    try {
      setLoading(true)
      setError(null)
      
      // Se já tem produtos carregados, usar filtro local
      if (allProducts.length > 0) {
        const filtered = allProducts.filter((product: Product) => {
          if (statusFilter === 'all') return true
          if (statusFilter === 'active') return product.active
          if (statusFilter === 'inactive') return !product.active
          return true
        })
        
        // Paginar
        const start = (currentPage - 1) * itemsPerPage
        const end = start + itemsPerPage
        setProducts(filtered.slice(start, end))
        setTotalItems(filtered.length)
        setTotalPages(Math.ceil(filtered.length / itemsPerPage))
      }
    } catch (error) {
      console.error('Erro ao paginar produtos:', error)
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
        const deletedProduct = products.find(p => p.id === id)
        setProducts(products.filter((p) => p.id !== id))
        
        // Atualizar contagens
        setTotalItems(Math.max(0, totalItems - 1))
        if (deletedProduct?.active) {
          setTotalActive(Math.max(0, totalActive - 1))
        } else {
          setTotalInactive(Math.max(0, totalInactive - 1))
        }
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

  // Cálculos com base em variações (apenas da página atual)
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
    const matchesSearch =
      product.name.toLowerCase().includes(searchLower) ||
      (product.mlListingId && product.mlListingId.toLowerCase().includes(searchLower)) ||
      (product.shopeeListingId && product.shopeeListingId.toLowerCase().includes(searchLower))
    
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && product.active) ||
      (statusFilter === 'inactive' && !product.active)
    
    return matchesSearch && matchesStatus
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Produtos</h1>
          <p className="text-gray-600 mt-1">{totalItems} produtos no total</p>
        </div>
        <Button onClick={handleCreate} className="bg-primary-600 hover:bg-primary-700">
          + Novo Produto
        </Button>
      </div>

      {/* Busca e Filtros */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, código ML ou Shopee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Filtrar:</span>
          <Badge 
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setStatusFilter('all')}
          >
            Todos ({totalItems})
          </Badge>
          <Badge 
            variant={statusFilter === 'active' ? 'default' : 'outline'}
            className="cursor-pointer bg-green-100 text-green-800 hover:bg-green-200"
            onClick={() => setStatusFilter('active')}
          >
            ✓ Ativos ({totalActive})
          </Badge>
          <Badge 
            variant={statusFilter === 'inactive' ? 'destructive' : 'outline'}
            className="cursor-pointer"
            onClick={() => setStatusFilter('inactive')}
          >
            ✕ Inativos ({totalInactive})
          </Badge>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:border-gray-300 transition">
          <p className="text-sm text-gray-600 font-medium">Total de Produtos</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalItems}</p>
          <p className="text-xs text-gray-500 mt-2">ø {products.length} por página</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:border-gray-300 transition">
          <p className="text-sm text-gray-600 font-medium">Estoque (Página)</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{totalStockQuantity}</p>
          <p className="text-xs text-gray-500 mt-2">unidades</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:border-gray-300 transition">
          <p className="text-sm text-gray-600 font-medium">Receita (Página)</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-gray-500 mt-2">faturamento</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:border-gray-300 transition">
          <p className="text-sm text-gray-600 font-medium">Custo (Página)</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{formatCurrency(totalCost)}</p>
          <p className="text-xs text-gray-500 mt-2">gasto</p>
        </div>
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
              const isExpanded = expandedProduct === product.id
              const variantCount = product.variants?.length || 0

              return (
                <div key={product.id}>
                  {/* HEADER DO PRODUTO */}
                  <div
                    onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition flex items-center justify-between overflow-x-auto"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
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
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 truncate text-sm">{product.name}</h3>
                            <span 
                              className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                                product.active 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {product.active ? '✓ Ativo' : '✕ Inativo'}
                            </span>
                          </div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {product.category && (
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                                {product.category.name}
                              </span>
                            )}
                            {product.mlListingId && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-yellow-100 px-2 py-1 rounded text-yellow-700 font-mono">
                                  ML: {extractMLCode(product.mlListingId)}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(extractMLCode(product.mlListingId || ''))}
                                  className="p-1 hover:bg-yellow-200 rounded transition"
                                  title="Copiar código ML"
                                >
                                  <svg className="w-4 h-4 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                            {product.shopeeListingId && (
                              <span className="text-xs bg-red-100 px-2 py-1 rounded text-red-700 font-mono">
                                {product.shopeeListingId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* STATS DO PRODUTO + AÇÕES */}
                    <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                      {/* Variações */}
                      <div className="text-right whitespace-nowrap">
                        <div className="text-sm text-gray-600">Variações</div>
                        <div className="text-lg font-bold text-blue-600">{variantCount}</div>
                      </div>

                      {/* Estoque */}
                      <div className="text-right whitespace-nowrap">
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
                      <div className="text-right whitespace-nowrap">
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
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(product)
                          }}
                          disabled={deleting === product.id}
                          title="Editar produto"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(product.id)
                          }}
                          disabled={deleting === product.id}
                          className="hover:text-red-600"
                          title="Deletar produto"
                        >
                          <Trash2 className="w-4 h-4" />
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
                            const parsedTitle = parseVariantTitle(variant.title)

                            const variantName = variant.model && variant.color
                              ? `${variant.model.name} - ${variant.color.name}`
                              : variant.cod

                            return (
                              <div
                                key={variant.id}
                                className="bg-white border rounded p-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 items-center"
                              >
                                {/* Variação (Modelo - Cor ou Parsed Title) */}
                                <div className="sm:col-span-2 lg:col-span-2">
                                  <div className="text-xs text-gray-500 font-semibold">Variação</div>
                                  {parsedTitle ? (
                                    <div className="mt-2 space-y-1.5">
                                      {parsedTitle.cor && (
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className="text-base">🎨</span>
                                          <span className="font-medium text-gray-700">{parsedTitle.cor}</span>
                                        </div>
                                      )}
                                      {parsedTitle['nome do desenho'] && (
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className="text-base">📸</span>
                                          <span className="text-gray-600">{parsedTitle['nome do desenho']}</span>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-sm font-medium text-gray-700 truncate mt-1">
                                      {variantName}
                                    </div>
                                  )}
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

      {/* Paginação */}
      {!loading && totalPages > 1 && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Itens por página:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(parseInt(e.target.value))
                  setCurrentPage(1)
                }}
                className="border rounded px-3 py-1 text-sm"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>

            <div className="text-sm text-gray-600">
              Página <span className="font-semibold">{currentPage}</span> de <span className="font-semibold">{totalPages}</span>
              {' '}({totalItems} produtos no total)
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                ← Anterior
              </Button>

              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    // Mostrar página atual, primeira, última e +/- 1 página
                    return (
                      page === currentPage ||
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) === 1
                    )
                  })
                  .map((page, index, array) => (
                    <div key={page}>
                      {index > 0 && array[index - 1] !== page - 1 && (
                        <span className="px-2 py-1 text-gray-400">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded border transition ${
                          currentPage === page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:border-blue-600 hover:text-blue-600'
                        }`}
                      >
                        {page}
                      </button>
                    </div>
                  ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Próximo →
              </Button>
            </div>
          </div>
        </div>
      )}

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
