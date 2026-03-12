'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus, ChevronDown, ChevronUp, Edit2 } from 'lucide-react'

interface DeviceColor {
  id: string
  name: string
  hexColor: string
  active: boolean
}

interface DeviceModel {
  id: string
  name: string
  active: boolean
  order: number
  modelColors: Array<{
    color: DeviceColor
  }>
  createdAt: string
  updatedAt: string
}

export default function DeviceModelManager() {
  const [models, setModels] = useState<DeviceModel[]>([])
  const [colors, setColors] = useState<DeviceColor[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedModel, setExpandedModel] = useState<string | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [newModel, setNewModel] = useState({
    name: '',
    colorIds: [] as string[],
  })
  const [editingModel, setEditingModel] = useState({
    name: '',
    colorIds: [] as string[],
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const [modelsRes, colorsRes] = await Promise.all([
        fetch('/api/device-models'),
        fetch('/api/device-colors'),
      ])

      const modelsData = await modelsRes.json()
      const colorsData = await colorsRes.json()

      if (modelsData.success) {
        const loadedModels = modelsData.data || []
        // Garantir que cada modelo tem modelColors
        const modelsWithColors = loadedModels.map((m: any) => ({
          ...m,
          modelColors: m.modelColors || [],
        }))
        setModels(modelsWithColors)
        console.log(`✅ ${loadedModels.length} modelos carregados`, modelsWithColors)
      }
      if (colorsData.success) {
        setColors(colorsData.data || [])
        console.log(`✅ ${colorsData.data?.length || 0} cores carregadas`)
      }
    } catch (error) {
      console.error('❌ Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newModel.name.trim()) return

    try {
      const response = await fetch('/api/device-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newModel),
      })

      const data = await response.json()
      if (data.success) {
        const createdModel = {
          ...data.data,
          modelColors: data.data.modelColors || [],
        }
        setModels([...models, createdModel])
        setNewModel({ name: '', colorIds: [] })
        setIsCreating(false)
        console.log(`✅ Modelo criado: ${createdModel.name}`, { colorCount: createdModel.modelColors.length })
      } else {
        alert(data.error || 'Erro ao criar modelo')
      }
    } catch (error) {
      console.error('❌ Erro ao criar modelo:', error)
      alert('Erro ao criar modelo')
    }
  }

  async function handleUpdate(id: string, updates: Partial<DeviceModel>) {
    try {
      const response = await fetch(`/api/device-models/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      const data = await response.json()
      if (data.success) {
        const updatedModel = {
          ...data.data,
          modelColors: data.data.modelColors || [],
        }
        setModels(models.map((m) => (m.id === id ? updatedModel : m)))
        console.log(`✅ Modelo atualizado via handleUpdate`, { id, colorCount: updatedModel.modelColors.length })
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar modelo:', error)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja deletar este modelo?')) return

    try {
      const response = await fetch(`/api/device-models/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setModels(models.filter((m) => m.id !== id))
      }
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  async function handleEditStart(model: DeviceModel) {
    try {
      setLoadingEdit(true)
      // Buscar modelo atualizado da API para garantir dados completos
      const response = await fetch(`/api/device-models/${model.id}`)
      const data = await response.json()
      
      if (data.success && data.data) {
        const freshModel = data.data
        const modelColors = freshModel.modelColors || []
        const colorIds = modelColors
          .map((mc: any) => {
            if (typeof mc === 'string') return mc
            if (mc?.color?.id) return mc.color.id
            if (mc?.colorId) return mc.colorId
            return null
          })
          .filter(Boolean)
        
        setExpandedModel(model.id) // Expandir automaticamente
        setEditingId(model.id)
        setEditingModel({
          name: freshModel.name,
          colorIds: colorIds as string[],
        })
        
        console.log(`🎯 Editando modelo: ${freshModel.name}`, { 
          modelColorCount: modelColors.length,
          colorIds,
          freshModel
        })
      } else {
        console.error('❌ Erro ao carregar modelo:', data.error)
      }
    } catch (error) {
      console.error('❌ Erro ao buscar modelo para edição:', error)
      alert('Erro ao carregar dados do modelo')
    } finally {
      setLoadingEdit(false)
    }
  }

  async function handleEditSave(id: string) {
    if (!editingModel.name.trim()) return

    try {
      const response = await fetch(`/api/device-models/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingModel),
      })

      const data = await response.json()
      if (data.success) {
        const updatedModel = {
          ...data.data,
          modelColors: data.data.modelColors || [],
        }
        setModels(models.map((m) => (m.id === id ? updatedModel : m)))
        setEditingId(null)
        console.log(`✅ Modelo atualizado: ${updatedModel.name}`, { colorIds: updatedModel.modelColors.map((mc: any) => mc.color?.id) })
      } else {
        alert(data.error || 'Erro ao atualizar modelo')
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar modelo:', error)
      alert('Erro ao atualizar modelo')
    }
  }

  function handleEditCancel() {
    setEditingId(null)
    setEditingModel({ name: '', colorIds: [] })
  }

  async function handleUpdateColors(modelId: string, colorIds: string[]) {
    await handleUpdate(modelId, { ...models.find((m) => m.id === modelId)!, colorIds } as any)
  }

  const filteredModels = models.filter((m) =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="p-4">Carregando modelos...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Modelos de Dispositivos</h2>
        <Button onClick={() => setIsCreating(!isCreating)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Novo Modelo
        </Button>
      </div>

      {isCreating && (
        <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
          <Input
            placeholder="Nome do modelo (ex: iPhone 14 Pro Max)"
            value={newModel.name}
            onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
            autoFocus
          />

          <div>
            <p className="text-sm font-medium mb-2">Cores Disponíveis</p>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2">
              {colors.filter((c) => c.active).map((color) => (
                <label key={color.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newModel.colorIds.includes(color.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewModel({
                          ...newModel,
                          colorIds: [...newModel.colorIds, color.id],
                        })
                      } else {
                        setNewModel({
                          ...newModel,
                          colorIds: newModel.colorIds.filter((id) => id !== color.id),
                        })
                      }
                    }}
                  />
                  <div
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: color.hexColor }}
                  />
                  <span className="text-sm">{color.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>
              Salvar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsCreating(false)
                setNewModel({ name: '', colorIds: [] })
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <Input
        placeholder="Buscar modelo..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="space-y-2">
        {filteredModels.map((model) => (
          <div key={model.id} className="border rounded-lg overflow-hidden">
            <div
              className="flex items-center gap-3 p-3 bg-white cursor-pointer hover:bg-gray-50"
              onClick={() =>
                setExpandedModel(expandedModel === model.id ? null : model.id)
              }
            >
              {expandedModel === model.id ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              <div className="flex-1">
                <p className="font-medium">{model.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={model.active ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUpdate(model.id, { active: !model.active })
                  }}
                >
                  {model.active ? 'Ativo' : 'Inativo'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditStart(model)
                  }}
                >
                  <Edit2 className="w-4 h-4 text-blue-500" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(model.id)
                  }}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>

            {expandedModel === model.id && (
              <div className="bg-gray-50 border-t p-4 space-y-3">
                {editingId === model.id ? (
                  <div className="space-y-3 bg-white rounded p-3 border">
                    <p className="text-sm font-medium">
                      Editar Modelo {loadingEdit && '(Carregando...)'}
                    </p>
                    {loadingEdit ? (
                      <div className="text-center py-4 text-gray-500">
                        <p className="text-sm">Carregando dados do modelo...</p>
                      </div>
                    ) : (
                      <>
                        <Input
                          placeholder="Nome do modelo"
                          value={editingModel.name}
                          onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                          autoFocus
                        />
                        <div>
                          <p className="text-sm font-medium mb-2">Cores ({editingModel.colorIds.length} selecionadas)</p>
                          <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                            {!colors || colors.length === 0 ? (
                              <p className="text-xs text-gray-500">Nenhuma cor disponível</p>
                            ) : (
                              colors.filter((c) => c.active).map((color) => {
                                const isChecked = editingModel.colorIds.includes(color.id)
                                return (
                                  <label key={color.id} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setEditingModel({
                                            ...editingModel,
                                            colorIds: [...editingModel.colorIds, color.id],
                                          })
                                        } else {
                                          setEditingModel({
                                            ...editingModel,
                                            colorIds: editingModel.colorIds.filter((id) => id !== color.id),
                                          })
                                        }
                                      }}
                                    />
                                    <div
                                      className="w-4 h-4 rounded border"
                                      style={{ backgroundColor: color.hexColor }}
                                    />
                                    <span className="text-sm">{color.name}</span>
                                  </label>
                                )
                              })
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleEditSave(model.id)}>
                            Salvar
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleEditCancel}>
                            Cancelar
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Cores Disponíveis para este Modelo ({(model.modelColors?.length || 0)} ativas)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {colors.filter((c) => c.active).map((color) => {
                        const modelColorsArray = model.modelColors || []
                        const isSelected = modelColorsArray.some((mc) => mc.color?.id === color.id)
                        return (
                          <label key={color.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const existingIds = modelColorsArray.map((mc) => mc.color?.id).filter(Boolean)
                                const newColorIds = isSelected
                                  ? existingIds.filter((id) => id !== color.id)
                                  : [...existingIds, color.id]
                                handleUpdateColors(model.id, newColorIds as string[])
                              }}
                            />
                            <div
                              className="w-4 h-4 rounded border"
                              style={{ backgroundColor: color.hexColor }}
                            />
                            <span className="text-sm">{color.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {filteredModels.length === 0 && (
          <p className="text-center text-gray-500 py-8">Nenhum modelo encontrado</p>
        )}
      </div>
    </div>
  )
}
