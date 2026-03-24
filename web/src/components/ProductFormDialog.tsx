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
import { Button } from '@/components/ui/button'
import CurrencyInput from '@/components/CurrencyInput'

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
  productCost?: number | null
  variants?: any[]
}

interface ProductFormDialogProps {
  product?: Product | null
  onClose: () => void
}

export default function ProductFormDialog({ product, onClose }: ProductFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Formulário básico do produto
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    productCost: product?.productCost || 0,
  })

  // Sincronizar formData quando o product mudar
  useEffect(() => {
    setFormData({
      name: product?.name || '',
      description: product?.description || '',
      productCost: product?.productCost || 0,
    })
  }, [product])

  function validateForm() {
    const errors: string[] = []

    if (!formData.name.trim()) errors.push('Nome do produto é obrigatório')

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
            productCost: formData.productCost,
            variants: [],
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
            productCost: formData.productCost,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Erro ao atualizar custos')
          return
        }

        alert('Custos atualizado com sucesso!')
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
            {product ? 'Ajustar Custo da Mercadoria' : 'Novo Produto'}
          </DialogTitle>
          <DialogDescription>
            {product
              ? 'Ajuste o custo da mercadoria.'
              : 'Crie um novo produto com seus dados básicos e custos.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-red-700 whitespace-pre-line text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção: Custos */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="text-lg font-semibold mb-4">Custos</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">💰 Custo Mercadoria</label>
                <CurrencyInput
                  value={formData.productCost || 0}
                  onChange={(value) => setFormData({ ...formData, productCost: value })}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : product ? 'Atualizar Custos' : 'Criar Produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
