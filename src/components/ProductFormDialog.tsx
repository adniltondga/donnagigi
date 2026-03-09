'use client'

import { useState } from 'react'
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
}

interface ProductFormDialogProps {
  product?: Product | null
  onClose: () => void
}

export default function ProductFormDialog({ product, onClose }: ProductFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: product?.name || '',
    baseModel: product?.baseModel || '',
    colorVariant: product?.colorVariant || '',
    supplier: product?.supplier || '',
    purchaseCost: product?.purchaseCost.toString() || '0',
    boxCost: product?.boxCost.toString() || '0',
    mlTariff: product?.mlTariff.toString() || '0',
    deliveryTariff: product?.deliveryTariff.toString() || '0',
    salePrice: product?.salePrice.toString() || '0',
    stock: product?.stock.toString() || '0',
    minStock: product?.minStock.toString() || '5',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  function validateForm() {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório'
    if (parseFloat(formData.purchaseCost) < 0) newErrors.purchaseCost = 'Valor inválido'
    if (parseFloat(formData.salePrice) < 0) newErrors.salePrice = 'Valor inválido'
    if (parseInt(formData.stock) < 0) newErrors.stock = 'Valor inválido'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!validateForm()) return

    try {
      setLoading(true)

      const url = product ? `/api/products/${product.id}` : '/api/products'
      const method = product ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          baseModel: formData.baseModel || null,
          colorVariant: formData.colorVariant || null,
          supplier: formData.supplier || null,
          purchaseCost: parseFloat(formData.purchaseCost),
          boxCost: parseFloat(formData.boxCost),
          mlTariff: parseFloat(formData.mlTariff),
          deliveryTariff: parseFloat(formData.deliveryTariff),
          salePrice: parseFloat(formData.salePrice),
          stock: parseInt(formData.stock),
          minStock: parseInt(formData.minStock),
        }),
      })

      if (response.ok) {
        alert(product ? 'Produto atualizado!' : 'Produto criado!')
        onClose()
      } else {
        alert('Erro ao salvar produto')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao salvar produto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {product ? 'Editar Produto' : 'Novo Produto'}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do produto. Todos os campos são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seção: Informações Básicas */}
          <div>
            <h3 className="font-semibold mb-3">Informações Básicas</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Nome do Produto *</label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Capinha Magnética Colorida Fosca"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Modelo</label>
                  <Input
                    value={formData.baseModel}
                    onChange={(e) =>
                      setFormData({ ...formData, baseModel: e.target.value })
                    }
                    placeholder="iPhone 14 Pro Max"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Cor</label>
                  <Input
                    value={formData.colorVariant}
                    onChange={(e) =>
                      setFormData({ ...formData, colorVariant: e.target.value })
                    }
                    placeholder="Preta"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Fornecedor</label>
                  <Input
                    value={formData.supplier}
                    onChange={(e) =>
                      setFormData({ ...formData, supplier: e.target.value })
                    }
                    placeholder="capa25"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção: Custos */}
          <div>
            <h3 className="font-semibold mb-3">Custos (R$)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Custo do Produto</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.purchaseCost}
                  onChange={(e) =>
                    setFormData({ ...formData, purchaseCost: e.target.value })
                  }
                  placeholder="13.32"
                  className={errors.purchaseCost ? 'border-red-500' : ''}
                />
                {errors.purchaseCost && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.purchaseCost}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Custo da Caixa</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.boxCost}
                  onChange={(e) =>
                    setFormData({ ...formData, boxCost: e.target.value })
                  }
                  placeholder="0.43"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tarifa ML</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.mlTariff}
                  onChange={(e) =>
                    setFormData({ ...formData, mlTariff: e.target.value })
                  }
                  placeholder="10.78"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tarifa Entrega</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.deliveryTariff}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deliveryTariff: e.target.value,
                    })
                  }
                  placeholder="12.35"
                />
              </div>
            </div>
          </div>

          {/* Seção: Preço e Estoque */}
          <div>
            <h3 className="font-semibold mb-3">Preço e Estoque</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Preço de Venda (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.salePrice}
                  onChange={(e) =>
                    setFormData({ ...formData, salePrice: e.target.value })
                  }
                  placeholder="59.90"
                  className={errors.salePrice ? 'border-red-500' : ''}
                />
                {errors.salePrice && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.salePrice}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Quantidade em Estoque *</label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: e.target.value })
                  }
                  placeholder="10"
                  className={errors.stock ? 'border-red-500' : ''}
                />
                {errors.stock && (
                  <p className="text-red-500 text-xs mt-1">{errors.stock}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Estoque Mínimo</label>
                <Input
                  type="number"
                  value={formData.minStock}
                  onChange={(e) =>
                    setFormData({ ...formData, minStock: e.target.value })
                  }
                  placeholder="5"
                />
              </div>
            </div>
          </div>

          {/* Cálculo da Margem */}
          <div className="bg-blue-50 p-3 rounded border border-blue-200">
            <p className="text-sm">
              <strong>Margem Estimada:</strong>{' '}
              <span className="text-blue-600 font-semibold">
                R${' '}
                {(
                  parseFloat(formData.salePrice) -
                  (parseFloat(formData.purchaseCost) +
                    parseFloat(formData.boxCost) +
                    parseFloat(formData.mlTariff) +
                    parseFloat(formData.deliveryTariff))
                ).toFixed(2)}
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : product ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
