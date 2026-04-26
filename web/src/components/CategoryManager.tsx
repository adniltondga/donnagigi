'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Edit2, Trash2, Plus, X } from 'lucide-react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingState } from '@/components/ui/loading-state'

interface Category {
  id: string
  name: string
  active: boolean
  order: number
  _count?: {
    products: number
  }
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
  })

  useEffect(() => {
    fetchCategories()
  }, [])

  async function fetchCategories() {
    try {
      setLoading(true)
      const response = await fetch('/api/categories')
      const data = await response.json()
      if (data.success) {
        setCategories(data.data)
      }
    } catch (error) {
      console.error('Erro:', error)
      setError('Erro ao carregar categorias')
    } finally {
      setLoading(false)
    }
  }

  function handleCreate() {
    setEditingId(null)
    setFormData({ name: '' })
    setShowForm(true)
  }

  function handleEdit(category: Category) {
    setEditingId(category.id)
    setFormData({
      name: category.name,
    })
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    const ok = await confirmDialog({
      title: 'Deletar categoria?',
      description: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Deletar',
      variant: 'danger',
    })
    if (!ok) return

    try {
      setDeleting(id)
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setCategories(categories.filter((c) => c.id !== id))
        setSuccess('Categoria deletada com sucesso!')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.error || 'Erro ao deletar')
      }
    } catch (error) {
      console.error('Erro:', error)
      setError('Erro ao deletar categoria')
    } finally {
      setDeleting(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!formData.name.trim()) {
      setError('Nome é obrigatório')
      return
    }

    try {
      const url = editingId ? `/api/categories/${editingId}` : '/api/categories'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(editingId ? 'Categoria atualizada!' : 'Categoria criada!')
        setShowForm(false)
        fetchCategories()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.error || 'Erro ao salvar')
      }
    } catch (error) {
      console.error('Erro:', error)
      setError('Erro ao salvar categoria')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Categorias</h1>
        <p className="text-muted-foreground">Gerencie as categorias de produtos</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex justify-between items-center">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError(null)}>
            <X className="w-5 h-5 text-red-600" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex justify-between items-center">
          <p className="text-green-700 text-sm">{success}</p>
          <button onClick={() => setSuccess(null)}>
            <X className="w-5 h-5 text-green-600" />
          </button>
        </div>
      )}

      <div>
        <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="w-4 h-4" />
          Nova Categoria
        </Button>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        {loading ? (
          <LoadingState variant="inline" label="Carregando categorias..." />
        ) : categories.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            Nenhuma categoria cadastrada
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="px-6 py-3 text-left text-sm font-semibold">Nome</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Produtos</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} className="border-b hover:bg-accent">
                    <td className="px-6 py-4 font-medium text-foreground">
                      {category.name}
                    </td>
                    <td className="px-6 py-4 text-center text-sm">
                      {category._count?.products || 0}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${
                          category.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        {category.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(category)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(category.id)}
                          disabled={deleting === category.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Atualize os dados da categoria'
                : 'Crie uma nova categoria'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Capinhas, Películas, Acessórios"
                required
              />
            </div>



            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingId ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
