'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus } from 'lucide-react'
import ImageUploadVariant from './ImageUploadVariant'
import CurrencyInput from './CurrencyInput'

export interface Variant {
  id?: string
  cod: string
  modelId?: string
  colorId?: string
  stock: number
  salePrice: number
  attributes?: Record<string, string>
  productId?: string
}

export interface Attribute {
  name: string
  type: string
  values: string[]
}

interface VariantFormProps {
  variants: Variant[]
  attributes: Attribute[]
  onVariantsChange: (variants: Variant[]) => void
  onAttributesChange: (attributes: Attribute[]) => void
  baseSalePrice?: number
}

interface DeviceModel {
  id: string
  name: string
  modelColors: Array<{ color: { id: string; name: string; hexColor: string } }>
}

interface DeviceColor {
  id: string
  name: string
  hexColor: string
}

export default function VariantForm({
  variants,
  onVariantsChange,
  baseSalePrice = 0,
}: VariantFormProps) {
  const [models, setModels] = useState<DeviceModel[]>([])
  const [colors, setColors] = useState<DeviceColor[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [modelSearch, setModelSearch] = useState<Record<number, string>>({})
  const [openDropdown, setOpenDropdown] = useState<number | null>(null)
  const [loadingColors, setLoadingColors] = useState<Record<number, boolean>>({})

  useEffect(() => {
    fetchModelsAndColors()
  }, [])

  // Popular modelSearch quando há variantes com modelId já salvo
  useEffect(() => {
    if (models.length > 0 && variants.length > 0) {
      const newModelSearch: Record<number, string> = { ...modelSearch }
      
      variants.forEach((variant, idx) => {
        if (variant.modelId) {
          const model = models.find((m) => m.id === variant.modelId)
          if (model) {
            newModelSearch[idx] = model.name
          }
        }
      })
      
      setModelSearch(newModelSearch)
    }
  }, [models])

  async function fetchModelsAndColors() {
    try {
      const [modelsRes, colorsRes] = await Promise.all([
        fetch('/api/device-models'),
        fetch('/api/device-colors'),
      ])

      const modelsData = await modelsRes.json()
      const colorsData = await colorsRes.json()

      if (modelsData.success) setModels(modelsData.data?.filter((m: any) => m.active) || [])
      if (colorsData.success) setColors(colorsData.data?.filter((c: any) => c.active) || [])
    } catch (error) {
      console.error('❌ Erro ao carregar modelos e cores:', error)
    } finally {
      setLoadingData(false)
    }
  }

  function addVariant() {
    const newVariant: Variant = {
      cod: '',
      stock: 0,
      salePrice: baseSalePrice || 0,
    }
    onVariantsChange([...variants, newVariant])
  }

  function removeVariant(index: number) {
    onVariantsChange(variants.filter((_, i) => i !== index))
  }

  function updateVariant(index: number, field: string, value: unknown) {
    const updated = [...variants]
    updated[index] = { ...updated[index], [field]: value }
    onVariantsChange(updated)
  }

  function getAvailableColors(modelId?: string) {
    if (!modelId) return colors
    const model = models.find((m) => m.id === modelId)
    if (!model) return []
    
    const availableColors = model.modelColors?.map((mc) => mc.color) || []
    return availableColors
  }

  function getFilteredModels(searchText: string) {
    if (!searchText) return models
    return models.filter((model) =>
      model.name.toLowerCase().includes(searchText.toLowerCase())
    )
  }

  function handleModelSelect(idx: number, modelId: string) {
    const selectedModel = models.find((m) => m.id === modelId)
    setLoadingColors({ ...loadingColors, [idx]: true })
    
    // Simula um pequeno delay para mostrar o loading
    setTimeout(() => {
      // Atualiza TUDO de uma vez, em vez de duas chamadas separadas
      const updated = [...variants]
      updated[idx] = {
        ...updated[idx],
        modelId: modelId,
        colorId: undefined
      }
      onVariantsChange(updated)
      
      setModelSearch({ ...modelSearch, [idx]: selectedModel?.name || '' })
      setOpenDropdown(null)
      setLoadingColors({ ...loadingColors, [idx]: false })
    }, 300)
  }

  if (loadingData) {
    return <div className="p-4 text-center">Carregando modelos e cores...</div>
  }

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Variações do Produto ({variants.length})</h3>
          <Button type="button" size="sm" onClick={addVariant}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Variação
          </Button>
        </div>

        {variants.length > 0 ? (
          <div className="space-y-4">
            {variants.map((variant, idx) => {
              const selectedModel = models.find((m) => m.id === variant.modelId)
              const availableColors = getAvailableColors(variant.modelId)

              return (
                <div key={idx} className="bg-white border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">
                      Variação {idx + 1}
                      {selectedModel && (
                        <span className="text-sm text-gray-500 ml-2">
                          ({selectedModel.name}
                          {variant.colorId &&
                            ` - ${colors.find((c) => c.id === variant.colorId)?.name}`}
                          )
                        </span>
                      )}
                    </h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariant(idx)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <label className="block text-sm font-medium mb-1">Modelo *</label>
                      <Input
                        type="text"
                        placeholder="Digite para buscar..."
                        value={modelSearch[idx] || ''}
                        onChange={(e) => {
                          setModelSearch({ ...modelSearch, [idx]: e.target.value })
                          if (e.target.value.length > 0) {
                            setOpenDropdown(idx)
                          } else {
                            setOpenDropdown(null)
                          }
                        }}
                        onFocus={() => {
                          if (modelSearch[idx] && selectedModel?.name !== modelSearch[idx]) {
                            setOpenDropdown(idx)
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setOpenDropdown(null), 150)
                        }}
                        required
                      />
                      {openDropdown === idx && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                          {getFilteredModels(modelSearch[idx]).length > 0 ? (
                            getFilteredModels(modelSearch[idx]).map((model) => (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => handleModelSelect(idx, model.id)}
                                className="w-full text-left px-3 py-2 hover:bg-blue-100 transition border-b last:border-b-0"
                              >
                                {model.name}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500 text-sm">Nenhum modelo encontrado</div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Cor *</label>
                      {loadingColors[idx] && (
                        <div className="w-full border rounded px-3 py-2 bg-blue-50 text-blue-600 text-sm flex items-center">
                          <span className="inline-block animate-spin mr-2">⟳</span>
                          Carregando cores...
                        </div>
                      )}
                      {!loadingColors[idx] && variant.modelId && availableColors.length > 0 && (
                        <select
                          className="w-full border rounded px-3 py-2 bg-white"
                          value={variant.colorId || ''}
                          onChange={(e) => updateVariant(idx, 'colorId', e.target.value || undefined)}
                          required
                        >
                          <option value="">Selecionar cor...</option>
                          {availableColors.map((color) => (
                            <option key={color.id} value={color.id}>
                              {color.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {!loadingColors[idx] && variant.modelId && availableColors.length === 0 && (
                        <div className="w-full border rounded px-3 py-2 bg-red-50 border-red-200">
                          <div className="text-red-700 text-sm font-medium mb-2">
                            ❌ Nenhuma cor vinculada a este modelo
                          </div>
                          <p className="text-xs text-red-600">
                            Acesse o painel de Modelos de Dispositivo para vincular cores a &quot;{selectedModel?.name}&quot;
                          </p>
                        </div>
                      )}
                      {!loadingColors[idx] && !variant.modelId && (
                        <div className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600 text-sm">
                          Selecione um modelo primeiro
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">COD *</label>
                      <Input
                        placeholder="CAP-IP14-PRETO-001"
                        value={variant.cod}
                        onChange={(e) => updateVariant(idx, 'cod', e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Preço Venda * 
                        {baseSalePrice > 0 && (
                          <span className="text-xs text-blue-600 font-normal ml-2">
                            (padrão: R$ {baseSalePrice.toFixed(2)})
                          </span>
                        )}
                      </label>
                      <CurrencyInput
                        value={variant.salePrice || 0}
                        onChange={(value) => updateVariant(idx, 'salePrice', value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Estoque</label>
                      <Input
                        type="number"
                        placeholder="15"
                        value={variant.stock}
                        onChange={(e) => updateVariant(idx, 'stock', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  {/* Seção de Upload de Imagens */}
                  <div className="pt-4 border-t">
                    {variant.id ? (
                      <ImageUploadVariant
                        variantId={variant.id}
                        productId={variant.productId || ''}
                      />
                    ) : (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                        💡 <span className="font-medium">Dica:</span> Salve o produto primeiro para fazer upload de imagens desta variação.
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-6 bg-white border-2 border-dashed rounded-lg">
            <p className="text-gray-500 mb-3">Nenhuma variação adicionada</p>
            <Button type="button" size="sm" onClick={addVariant}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Primeira Variação
            </Button>
          </div>
        )}

        <p className="text-sm text-gray-500 mt-3">
          ℹ️ Mínimo 1 variação obrigatória. Cada variação precisa de Modelo, Cor, COD e Preço Venda.
        </p>
      </div>
    </div>
  )
}
