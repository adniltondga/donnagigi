'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Supplier {
  id: string
  name: string
  telephone?: string | null
  createdAt: string
  updatedAt: string
}

export default function SupplierManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    telephone: '',
  })

  // Fetch suppliers on mount
  useEffect(() => {
    fetchSuppliers()
  }, [])

  // Auto-dismiss messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null)
        setSuccess(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  async function fetchSuppliers() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/suppliers')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success) {
        setSuppliers(data.data || [])
      } else {
        setError(data.error || 'Erro ao carregar fornecedores')
      }
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error)
      setError(`Erro ao carregar fornecedores: ${error instanceof Error ? error.message : 'Desconhecido'}`)
    } finally {
      setLoading(false)
    }
  }

  function handleCreate() {
    setFormData({ name: '', telephone: '' })
    setEditing(null)
    setShowForm(true)
  }

  function handleEdit(supplier: Supplier) {
    setFormData({
      name: supplier.name,
      telephone: supplier.telephone || '',
    })
    setEditing(supplier.id)
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja deletar este fornecedor?')) {
      return
    }

    try {
      setDeleting(id)
      const response = await fetch(`/api/suppliers/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Fornecedor deletado com sucesso')
        await fetchSuppliers()
      } else {
        setError(data.error || 'Erro ao deletar fornecedor')
      }
    } catch (error) {
      console.error('Erro ao deletar fornecedor:', error)
      setError('Erro ao deletar fornecedor')
    } finally {
      setDeleting(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.name.trim()) {
      setError('Nome do fornecedor é obrigatório')
      return
    }

    try {
      const url = editing ? `/api/suppliers/${editing}` : '/api/suppliers'
      const method = editing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(editing ? 'Fornecedor atualizado com sucesso' : 'Fornecedor criado com sucesso')
        setShowForm(false)
        setFormData({ name: '', telephone: '' })
        await fetchSuppliers()
      } else {
        setError(data.error || 'Erro ao salvar fornecedor')
      }
    } catch (error) {
      console.error('Erro ao salvar fornecedor:', error)
      setError('Erro ao salvar fornecedor')
    }
  }

  if (loading) {
    return <div className="p-6">Carregando fornecedores...</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">📦 Fornecedores</h1>
        <Button onClick={handleCreate} className="bg-primary-600 hover:bg-primary-700">
          + Novo Fornecedor
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg border border-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg border border-green-300">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Nome</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Telefone</th>
              <th className="px-6 py-3 text-right text-sm font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                  Nenhum fornecedor cadastrado
                </td>
              </tr>
            ) : (
              suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4">{supplier.name}</td>
                  <td className="px-6 py-4">{supplier.telephone || '-'}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(supplier)}
                      className="px-3 py-1 text-blue-600 hover:bg-blue-100 rounded transition"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleDelete(supplier.id)}
                      disabled={deleting === supplier.id}
                      className="px-3 py-1 text-red-600 hover:bg-red-100 rounded transition disabled:opacity-50"
                    >
                      {deleting === supplier.id ? '🗑️ Deletando...' : '🗑️ Deletar'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize as informações do fornecedor' : 'Adicione um novo fornecedor'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do fornecedor"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <Input
                type="tel"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                placeholder="(11) 98765-4321"
                className="w-full"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary-600 hover:bg-primary-700">
                {editing ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
