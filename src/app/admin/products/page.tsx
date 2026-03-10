'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/calculations'
import ProductFormDialog from '@/components/ProductFormDialog'

interface Product {
  id: string
  name: string
  baseModel: string | null
  colorVariant: string | null
  supplier: string | null
  purchaseCost: number
  boxCost: number
  mlTariff: number
  deliveryTariff: number
  salePrice: number
  calculatedMargin: number | null
  stock: number
  minStock: number
  mlListed: boolean
  mlListingId: string | null
  mlListingUrl: string | null
  shopeeListed: boolean
  shopeeListingId: string | null
  shopeeListingUrl: string | null
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/products')
      const data = await response.json()
      console.log('API Response:', data) // Debug
      if (data.success) {
        setProducts(data.data)
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

  const totalCost = products.reduce(
    (sum, p) => sum + (p.purchaseCost + p.boxCost + p.mlTariff + p.deliveryTariff) * p.stock,
    0
  )
  const totalRevenue = products.reduce((sum, p) => sum + p.salePrice * p.stock, 0)
  const totalMargin = totalRevenue - totalCost

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

      {/* Resumo */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Total de SKUs</p>
          <p className="text-2xl font-bold">{products.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Estoque Total</p>
          <p className="text-2xl font-bold">
            {products.reduce((sum, p) => sum + p.stock, 0)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Receita Total</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Margem Total</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(totalMargin)}
          </p>
        </div>
      </div>

      {/* Novo Produto */}
      <div>
        <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
          + Novo Produto
        </Button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-6 text-center">Carregando produtos...</div>
        ) : products.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Nenhum produto cadastrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Produto</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead className="text-right">Custo Unit.</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead>ML</TableHead>
                <TableHead>Shopee</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const totalCostUnit =
                  product.purchaseCost +
                  product.boxCost +
                  product.mlTariff +
                  product.deliveryTariff
                const margin = product.salePrice - totalCostUnit

                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      {product.name}
                    </TableCell>
                    <TableCell>{product.baseModel || '-'}</TableCell>
                    <TableCell>{product.colorVariant || '-'}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalCostUnit)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(product.salePrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600 font-semibold">
                        {formatCurrency(margin)}
                      </span>
                      <span className="text-gray-500 text-xs ml-1">
                        ({((margin / product.salePrice) * 100).toFixed(1)}%)
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {product.stock}
                      {product.stock <= product.minStock && (
                        <div className="text-xs text-orange-600">Baixo ⚠️</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.mlListed ? (
                        <div className="text-sm">
                          <div className="text-green-600 font-semibold">✓ Ativo</div>
                          {product.mlListingUrl && (
                            <a
                              href={product.mlListingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Ver anúncio
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Não anunciado</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.shopeeListed ? (
                        <div className="text-sm">
                          <div className="text-green-600 font-semibold">✓ Ativo</div>
                          {product.shopeeListingUrl && (
                            <a
                              href={product.shopeeListingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Ver anúncio
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Não anunciado</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(product)}
                          disabled={deleting === product.id}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(product.id)}
                          disabled={deleting === product.id}
                        >
                          {deleting === product.id ? 'Deletando...' : 'Deletar'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal de Formulário */}
      {showForm && (
        <ProductFormDialog
          product={selectedProduct}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
