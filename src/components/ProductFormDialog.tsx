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
import { feedback } from '@/lib/feedback'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { X, Upload, Download, Loader } from 'lucide-react'

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

interface ProductImage {
  id: string
  url: string
  mlUrl?: string | null
  order: number
  createdAt: string
}

interface ProductFormDialogProps {
  product?: Product | null
  onClose: () => void
}

export default function ProductFormDialog({ product, onClose }: ProductFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [importingML, setImportingML] = useState(false)

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

    // Carregar imagens se produto existe
    if (product?.id) {
      fetchImages()
    }
  }, [product])

  async function fetchImages() {
    if (!product?.id) return
    try {
      setLoadingImages(true)
      const response = await fetch(`/api/products/${product.id}/images`)
      if (response.ok) {
        const data = await response.json()
        setImages(data)
      }
    } catch (error) {
      console.error('Erro ao carregar imagens:', error)
    } finally {
      setLoadingImages(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!product?.id) return

    const file = e.target.files?.[0]
    if (!file) return

    try {
      setLoadingImages(true)
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/products/${product.id}/images`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        await fetchImages()
      } else {
        const data = await response.json()
        setError(data.error || 'Erro ao fazer upload da imagem')
      }
    } catch (error) {
      setError('Erro ao fazer upload da imagem')
      console.error(error)
    } finally {
      setLoadingImages(false)
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!product?.id) return

    const ok = await confirmDialog({
      title: 'Deletar imagem?',
      description: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Deletar',
      variant: 'danger',
    })
    if (!ok) return

    try {
      const response = await fetch(`/api/products/${product.id}/images/${imageId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchImages()
      } else {
        setError('Erro ao deletar imagem')
      }
    } catch (error) {
      setError('Erro ao deletar imagem')
      console.error(error)
    }
  }

  async function handleImportML() {
    if (!product?.id) return

    try {
      setImportingML(true)
      const response = await fetch(`/api/products/${product.id}/images/import-ml`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        await fetchImages()
        feedback.success(`${data.imported} imagens importadas do Mercado Livre`)
      } else {
        const data = await response.json()
        setError(data.error || 'Erro ao importar imagens')
      }
    } catch (error) {
      setError('Erro ao importar imagens')
      console.error(error)
    } finally {
      setImportingML(false)
    }
  }

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
          feedback.success('Produto criado com sucesso!')
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

        feedback.success('Custos atualizados com sucesso!')
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
            {product ? 'Gerenciar Produto' : 'Novo Produto'}
          </DialogTitle>
          <DialogDescription>
            {product
              ? 'Ajuste os custos e imagens do produto.'
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

          {/* Seção: Imagens (apenas se produto existe) */}
          {product && (
            <div className="border rounded-lg p-4 bg-purple-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">🖼️ Imagens do Produto</h3>
                {product.mlListingId && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleImportML}
                    disabled={importingML}
                    className="gap-2"
                  >
                    {importingML ? (
                      <Loader size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    Importar do ML
                  </Button>
                )}
              </div>

              {/* Grid de imagens */}
              {loadingImages ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader size={20} className="animate-spin mr-2" />
                  Carregando imagens...
                </div>
              ) : images.length > 0 ? (
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {images.map((image) => (
                    <div key={image.id} className="relative group">
                      <img
                        src={image.url}
                        alt="Produto"
                        className="w-full h-24 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(image.id)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-muted-foreground">Nenhuma imagem ainda</div>
              )}

              {/* Upload manual */}
              <div className="border-2 border-dashed border-purple-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={loadingImages}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload size={24} className="text-purple-600" />
                  <span className="text-sm font-medium">
                    {loadingImages ? 'Enviando...' : 'Clique ou arraste uma imagem'}
                  </span>
                  <span className="text-xs text-muted-foreground">Máximo 5MB</span>
                </label>
              </div>
            </div>
          )}

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
