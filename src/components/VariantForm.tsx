'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus } from 'lucide-react'

export interface Variant {
  id?: string
  cod: string
  modelId?: string
  colorId?: string
  stock: number
  attributes?: Record<string, string>
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
}: VariantFormProps) {
  const [models, setModels] = useState<DeviceModel[]>([])
  const [colors, setColors] = useState<DeviceColor[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    fetchModelsAndColors()
  }, [])

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
      console.error('Erro ao carregar modelos e cores:', error)
    } finally {
      setLoadingData(false)
    }
  }

  function addVariant() {
    const newVariant: Variant = {
      cod: '',
      stock: 0,
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
    if (!model) return colors
    return model.modelColors.map((mc) => mc.color)
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
                    <div>
                      <label className="block text-sm font-medium mb-1">Modelo *</label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={variant.modelId || ''}
                        onChange={(e) => {
                          updateVariant(idx, 'modelId', e.target.value || undefined)
                          updateVariant(idx, 'colorId', undefined)
                        }}
                        required
                      >
                        <option value="">Selecionar modelo...</option>
                        {models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Cor *</label>
                      <select
                        className="w-full border rounded px-3 py-2 bg-white"
                        value={variant.colorId || ''}
                        onChange={(e) => updateVariant(idx, 'colorId', e.target.value || undefined)}
                        required
                        disabled={!variant.modelId}
                      >
                        <option value="">
                          {!variant.modelId ? 'Selecione um modelo primeiro' : 'Selecionar cor...'}
                        </option>
                        {availableColors.map((color) => (
                          <option key={color.id} value={color.id}>
                            {color.name}
                          </option>
                        ))}
                      </select>
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
                      <label className="block text-sm font-medium mb-1">Estoque</label>
                      <Input
                        type="number"
                        placeholder="15"
                        value={variant.stock}
                        onChange={(e) => updateVariant(idx, 'stock', parseInt(e.target.value) || 0)}
                      />
                    </div>
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
          ℹ️ Mínimo 1 variação obrigatória. Cada variação precisa de Modelo, Cor, COD e preço de venda.
        </p>
      </div>
    </div>
  )
}
