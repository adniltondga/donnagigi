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
  categoryId?: string | null
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
  baseShoppeeTariff?: number | null
  baseShopeeDeliveryTariff?: number | null
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
    baseShoppeeTariff: product?.baseShoppeeTariff || 0,
    baseShopeeDeliveryTariff: product?.baseShopeeDeliveryTariff || 0,
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
      modelId: v.modelId || v.model?.id,
      colorId: v.colorId || v.color?.id,
      stock: v.stock,
      salePrice: v.salePrice || 0,
      attributes: v.attributes || {},
      productId: product?.id,
    })) || [
      {
        cod: '',
        stock: 0,
        salePrice: 0,
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
    if (variants.length === 0) errors.push('Mínimo 1 variação é obrigatória')

    variants.forEach((v, idx) => {
      if (!v.cod || v.cod.trim() === '') {
        errors.push(`Variação ${idx + 1}: COD é obrigatório`)
      }
      const salePrice = parseFloat(String(v.salePrice))
      if (isNaN(salePrice) || salePrice <= 0) {
        errors.push(`Variação ${idx + 1}: Preço Venda é obrigatório e deve ser maior que 0`)
      }
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
        console.log('📦 Criando novo produto com variações:', {
          variants: variants.map(v => ({
            cod: v.cod,
            salePrice: v.salePrice,
            stock: v.stock,
            modelId: v.modelId,
            colorId: v.colorId,
          }))
        })
        
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
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
            baseShoppeeTariff: formData.baseShoppeeTariff,
            baseShopeeDeliveryTariff: formData.baseShopeeDeliveryTariff,
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
            baseShoppeeTariff: formData.baseShoppeeTariff,
            baseShopeeDeliveryTariff: formData.baseShopeeDeliveryTariff,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Erro ao atualizar produto')
          return
        }

        // Atualizar variações existentes (com ID)
        const existingVariants = variants.filter(v => v.id)
        if (existingVariants.length > 0) {
          for (const variant of existingVariants) {
            const salePriceNum = typeof variant.salePrice === 'string' 
              ? parseFloat(variant.salePrice) 
              : variant.salePrice
            
            console.log('📝 Atualizando variação existente:', {
              variantId: variant.id,
              cod: variant.cod,
              salePrice: salePriceNum,
              stock: variant.stock,
              modelId: variant.modelId,
              colorId: variant.colorId,
            })

            const variantResponse = await fetch(`/api/products/${product.id}/variants/${variant.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cod: variant.cod,
                modelId: variant.modelId || null,
                colorId: variant.colorId || null,
                stock: variant.stock || 0,
                salePrice: salePriceNum,
              }),
            })

            if (!variantResponse.ok) {
              const data = await variantResponse.json()
              setError(data.error || 'Erro ao atualizar variação')
              return
            }
          }
        }

        // Adicionar novas variações (sem ID)
        const newVariants = variants.filter(v => !v.id)
        if (newVariants.length > 0) {
          for (const variant of newVariants) {
            const salePriceNum = typeof variant.salePrice === 'string' 
              ? parseFloat(variant.salePrice) 
              : variant.salePrice
            
            console.log('📝 Criando variação:', {
              cod: variant.cod,
              salePrice: salePriceNum,
              stock: variant.stock,
              modelId: variant.modelId,
              colorId: variant.colorId,
            })

            const variantResponse = await fetch(`/api/products/${product.id}/variants`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cod: variant.cod,
                modelId: variant.modelId || null,
                colorId: variant.colorId || null,
                stock: variant.stock || 0,
                salePrice: salePriceNum,
                attributes: variant.attributes || {},
              }),
            })

            if (!variantResponse.ok) {
              const data = await variantResponse.json()
              setError(data.error || 'Erro ao adicionar variação')
              return
            }
          }
        }

        alert('Produto atualizado com sucesso!')
        onClose()
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

              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Tarifa ML (R$)</label>
                  <CurrencyInput
                    value={formData.baseMLTariff}
                    onChange={(value) => setFormData({ ...formData, baseMLTariff: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tarifa Entrega ML (R$)</label>
                  <CurrencyInput
                    value={formData.baseDeliveryTariff}
                    onChange={(value) => setFormData({ ...formData, baseDeliveryTariff: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tarifa Shopee (R$)</label>
                  <CurrencyInput
                    value={formData.baseShoppeeTariff}
                    onChange={(value) => setFormData({ ...formData, baseShoppeeTariff: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tarifa Entrega Shopee (R$)</label>
                  <CurrencyInput
                    value={formData.baseShopeeDeliveryTariff}
                    onChange={(value) => setFormData({ ...formData, baseShopeeDeliveryTariff: value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Variações e Atributos */}
          <VariantForm
            variants={variants}
            attributes={attributes}
            onVariantsChange={setVariants}
            onAttributesChange={setAttributes}
            baseSalePrice={formData.baseSalePrice}
          />

          {product && (
            <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
              <div>
                <p className="text-sm text-blue-700 font-medium mb-2">
                  📸 Para fazer upload de imagens:
                </p>
                <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
                  <li>Clique em <strong>&apos;Produtos&apos;</strong> no menu lateral</li>
                  <li>Encontre o produto <strong>&apos;{product.name}&apos;</strong> na lista</li>
                  <li>Clique na seta <strong>(▶)</strong> ao lado do produto para expandir</li>
                  <li>Aí você encontrará a seção de upload de imagens 📁</li>
                </ol>
              </div>
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
