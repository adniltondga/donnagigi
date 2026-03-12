'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import VariantForm, { Variant, Attribute } from './VariantForm'
import CurrencyInput from './CurrencyInput'

interface Product {
  id: string
  name: string
  description?: string
  baseImage?: string
  categoryId?: string | null
  supplier?: string | null
  mlListingId?: string | null
  shopeeListingId?: string | null
  baseSalePrice?: number
  basePurchaseCost?: number
  baseBoxCost?: number
  baseMLTariff?: number
  baseDeliveryTariff?: number
  baseMLPrice?: number
  shopeePrice?: number
  variants?: any[]
}

interface ProductFormDialogProps {
  product?: Product | null
  onClose: () => void
}

export default function ProductFormDialog({ product, onClose }: ProductFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  // Formulário básico do produto
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    baseImage: product?.baseImage || '',
    categoryId: product?.categoryId || '',
    supplierId: product?.supplier || '',
    mlListingId: product?.mlListingId || '',
    shopeeListingId: product?.shopeeListingId || '',
    baseSalePrice: product?.baseSalePrice || 0,
    basePurchaseCost: product?.basePurchaseCost || 0,
    baseBoxCost: product?.baseBoxCost || 0,
    baseMLTariff: product?.baseMLTariff || 0,
    baseDeliveryTariff: product?.baseDeliveryTariff || 0,
    baseMLPrice: product?.baseMLPrice || 0,
    shopeePrice: product?.shopeePrice || 0,
  })

  useEffect(() => {
    fetchCategories()
    fetchSuppliers()
  }, [])

  async function fetchCategories() {
    try {
      const response = await fetch('/api/categories')
      const data = await response.json()
      if (data.success) {
        setCategories(data.data)
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error)
    }
  }

  async function fetchSuppliers() {
    try {
      const response = await fetch('/api/suppliers')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSuppliers(data.data || [])
        }
      }
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error)
    }
  }

  // Variações
  const [variants, setVariants] = useState<Variant[]>(
    product?.variants?.map((v: any) => ({
      id: v.id,
      cod: v.cod,
      modelId: v.modelId,
      colorId: v.colorId,
      stock: v.stock,
      attributes: v.attributes || {},
    })) || [
      {
        cod: '',
        stock: 0,
        attributes: {},
      },
    ]
  )

  // Atributos (Cor, Modelo, etc)
  const [attributes, setAttributes] = useState<Attribute[]>(
    product?.variants?.[0]?.attributes
      ? Object.entries(product.variants[0].attributes as Record<string, any>).map(
          ([name, value]) => ({
            name,
            type: 'text',
            values: [value],
          })
        )
      : []
  )

  function validateForm() {
    const errors: string[] = []

    if (!formData.name.trim()) errors.push('Nome do produto é obrigatório')
    if (!formData.baseImage.trim()) errors.push('Imagem base é obrigatória')
    if (variants.length === 0) errors.push('Mínimo 1 variação é obrigatória')

    variants.forEach((v, idx) => {
      if (!v.cod.trim()) errors.push(`Variação ${idx + 1}: COD é obrigatório`)
    })

    if (errors.length > 0) {
      setError(errors.join('\n'))
      return false
    }

    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!validateForm()) return

    try {
      setLoading(true)

      // Para novo produto, usar POST
      if (!product) {
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            baseImage: formData.baseImage,
            categoryId: formData.categoryId || null,
            supplier: formData.supplierId || null,
            mlListingId: formData.mlListingId || null,
            shopeeListingId: formData.shopeeListingId || null,
            baseSalePrice: formData.baseSalePrice,
            basePurchaseCost: formData.basePurchaseCost,
            baseBoxCost: formData.baseBoxCost,
            baseMLTariff: formData.baseMLTariff,
            baseDeliveryTariff: formData.baseDeliveryTariff,
            baseMLPrice: formData.baseMLPrice,
            shopeePrice: formData.shopeePrice,
            attributes,
            variants,
          }),
        })

        if (response.ok) {
          alert('Produto criado com sucesso!')
          onClose()
        } else {
          const data = await response.json()
          setError(data.error || 'Erro ao criar produto')
        }
      } else {
        // Para produto existente, atualizar dados gerais
        const response = await fetch(`/api/products/${product.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            baseImage: formData.baseImage,
            categoryId: formData.categoryId || null,
            supplier: formData.supplierId || null,
            mlListingId: formData.mlListingId || null,
            shopeeListingId: formData.shopeeListingId || null,
            baseSalePrice: formData.baseSalePrice,
            basePurchaseCost: formData.basePurchaseCost,
            baseBoxCost: formData.baseBoxCost,
            baseMLTariff: formData.baseMLTariff,
            baseDeliveryTariff: formData.baseDeliveryTariff,
            baseMLPrice: formData.baseMLPrice,
            shopeePrice: formData.shopeePrice,
          }),
        })

        if (response.ok) {
          alert('Produto atualizado com sucesso!')
          onClose()
        } else {
          const data = await response.json()
          setError(data.error || 'Erro ao atualizar produto')
        }
      }
    } catch (error) {
      setError('Erro ao salvar produto')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? 'Editar Produto' : 'Novo Produto com Variações'}
          </DialogTitle>
          <DialogDescription>
            {product
              ? 'Ajuste os dados do produto. Variações podem ser editadas separadamente.'
              : 'Crie um produto com múltiplas variações (cores, modelos, tamanhos, etc)'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-red-700 whitespace-pre-line text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção 1: Informações Básicas */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-semibold mb-4">Informações Básicas</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nome do Produto *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Capinha Magnética Colorida Fosca"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição detalhada do produto..."
                  className="w-full border rounded px-3 py-2 min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Imagem Base (URL) *</label>
                  <Input
                    type="url"
                    value={formData.baseImage}
                    onChange={(e) => setFormData({ ...formData, baseImage: e.target.value })}
                    placeholder="https://..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Categoria</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecionar categoria...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fornecedor</label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecionar fornecedor...</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Código Mercado Livre</label>
                  <Input
                    value={formData.mlListingId}
                    onChange={(e) => setFormData({ ...formData, mlListingId: e.target.value })}
                    placeholder="Ex: MCO123456789"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Código Shopee</label>
                  <Input
                    value={formData.shopeeListingId}
                    onChange={(e) => setFormData({ ...formData, shopeeListingId: e.target.value })}
                    placeholder="Ex: 123456789"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 1.5: Informações de Preço */}
          <div className="border rounded-lg p-4 bg-green-50">
            <h3 className="text-lg font-semibold mb-4">Informações de Preço (Padrão)</h3>
            <p className="text-sm text-gray-600 mb-4">Estes valores serão usados como padrão para todas as variações</p>
            <div className="space-y-3">
              {/* Linha 1: Preços principales */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Preço Venda (R$)</label>
                  <CurrencyInput
                    value={formData.baseSalePrice}
                    onChange={(value) => setFormData({ ...formData, baseSalePrice: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Preço ML (R$)</label>
                  <CurrencyInput
                    value={formData.baseMLPrice}
                    onChange={(value) => setFormData({ ...formData, baseMLPrice: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Preço Shopee (R$)</label>
                  <CurrencyInput
                    value={formData.shopeePrice}
                    onChange={(value) => setFormData({ ...formData, shopeePrice: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Custo (R$)</label>
                  <CurrencyInput
                    value={formData.basePurchaseCost}
                    onChange={(value) => setFormData({ ...formData, basePurchaseCost: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Embalagem (R$)</label>
                  <CurrencyInput
                    value={formData.baseBoxCost}
                    onChange={(value) => setFormData({ ...formData, baseBoxCost: value })}
                  />
                </div>
              </div>
              
              {/* Linha 2: Tarifas */}
              <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Tarifa ML ou Shoppe (R$)</label>
                  <CurrencyInput
                    value={formData.baseMLTariff}
                    onChange={(value) => setFormData({ ...formData, baseMLTariff: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tarifa Entrega (R$)</label>
                  <CurrencyInput
                    value={formData.baseDeliveryTariff}
                    onChange={(value) => setFormData({ ...formData, baseDeliveryTariff: value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Variações e Atributos */}
          {!product && (
            <VariantForm
              variants={variants}
              attributes={attributes}
              onVariantsChange={setVariants}
              onAttributesChange={setAttributes}
            />
          )}

          {product && (
            <div className="border rounded-lg p-4 bg-blue-50">
              <p className="text-sm text-blue-700">
                ℹ️ Clique na seta (▶) ao lado do produto na página de produtos para expandir e gerenciar as variações.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : product ? 'Atualizar Produto' : 'Criar Produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
