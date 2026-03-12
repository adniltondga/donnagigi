'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus, Edit2 } from 'lucide-react'

interface DeviceColor {
  id: string
  name: string
  hexColor: string
  active: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export default function DeviceColorManager() {
  const [colors, setColors] = useState<DeviceColor[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newColor, setNewColor] = useState({ name: '', hexColor: '#000000' })
  const [editingColor, setEditingColor] = useState({ name: '', hexColor: '#000000' })
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchColors()
  }, [])

  async function fetchColors() {
    try {
      setLoading(true)
      const response = await fetch('/api/device-colors')
      const data = await response.json()
      if (data.success) {
        setColors(data.data || [])
      }
    } catch (error) {
      console.error('Erro ao buscar cores:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newColor.name.trim()) return

    try {
      const response = await fetch('/api/device-colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newColor),
      })

      const data = await response.json()
      if (data.success) {
        setColors([...colors, data.data])
        setNewColor({ name: '', hexColor: '#000000' })
        setIsCreating(false)
      } else {
        alert(data.error || 'Erro ao criar cor')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao criar cor')
    }
  }

  async function handleUpdate(id: string, updates: Partial<DeviceColor>) {
    try {
      const response = await fetch(`/api/device-colors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      const data = await response.json()
      if (data.success) {
        setColors(colors.map((c) => (c.id === id ? data.data : c)))
      }
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja deletar esta cor?')) return

    try {
      const response = await fetch(`/api/device-colors/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setColors(colors.filter((c) => c.id !== id))
      }
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  function handleEditStart(color: DeviceColor) {
    setEditingId(color.id)
    setEditingColor({
      name: color.name,
      hexColor: color.hexColor,
    })
  }

  async function handleEditSave(id: string) {
    if (!editingColor.name.trim()) return

    try {
      const response = await fetch(`/api/device-colors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingColor),
      })

      const data = await response.json()
      if (data.success) {
        setColors(colors.map((c) => (c.id === id ? data.data : c)))
        setEditingId(null)
      } else {
        alert(data.error || 'Erro ao atualizar cor')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao atualizar cor')
    }
  }

  function handleEditCancel() {
    setEditingId(null)
    setEditingColor({ name: '', hexColor: '#000000' })
  }

  const filteredColors = colors.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="p-4">Carregando cores...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Cores Disponíveis</h2>
        <Button onClick={() => setIsCreating(!isCreating)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nova Cor
        </Button>
      </div>

      {isCreating && (
        <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Nome da cor"
              value={newColor.name}
              onChange={(e) => setNewColor({ ...newColor, name: e.target.value })}
            />
            <div className="flex gap-2">
              <input
                type="color"
                value={newColor.hexColor}
                onChange={(e) => setNewColor({ ...newColor, hexColor: e.target.value })}
                className="w-12 h-10 border rounded"
              />
              <Input
                placeholder="#000000"
                value={newColor.hexColor}
                onChange={(e) => setNewColor({ ...newColor, hexColor: e.target.value })}
              />
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
                setNewColor({ name: '', hexColor: '#000000' })
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <Input
        placeholder="Buscar cor..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="space-y-2">
        {filteredColors.map((color) => (
          <div key={color.id} className="border rounded-lg overflow-hidden">
            {editingId === color.id ? (
              <div className="bg-gray-50 border-t p-4 space-y-3">
                <p className="text-sm font-medium">Editar Cor</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Nome da cor"
                    value={editingColor.name}
                    onChange={(e) => setEditingColor({ ...editingColor, name: e.target.value })}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={editingColor.hexColor}
                      onChange={(e) => setEditingColor({ ...editingColor, hexColor: e.target.value })}
                      className="w-12 h-10 border rounded"
                    />
                    <Input
                      placeholder="#000000"
                      value={editingColor.hexColor}
                      onChange={(e) => setEditingColor({ ...editingColor, hexColor: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleEditSave(color.id)}>
                    Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleEditCancel}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-white">
                <div
                  className="w-8 h-8 rounded border"
                  style={{ backgroundColor: color.hexColor }}
                />
                <div className="flex-1">
                  <p className="font-medium">{color.name}</p>
                  <p className="text-sm text-gray-500">{color.hexColor}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={color.active ? 'default' : 'outline'}
                    onClick={() => handleUpdate(color.id, { active: !color.active })}
                  >
                    {color.active ? 'Ativo' : 'Inativo'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditStart(color)}
                  >
                    <Edit2 className="w-4 h-4 text-blue-500" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(color.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredColors.length === 0 && (
          <p className="text-center text-gray-500 py-8">Nenhuma cor encontrada</p>
        )}
      </div>
    </div>
  )
}
