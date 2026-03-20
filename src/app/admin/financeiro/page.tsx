'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { Info } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
}

interface Bill {
  id: string;
  type: string;
  description: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
  category: string;
  supplierId: string | null;
  supplier: Supplier | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  type: 'payable' | 'receivable';
  description: string;
  amount: string;
  dueDate: string;
  category: string;
  supplierId: string;
  notes: string;
}

interface Summary {
  totalPayable: number;
  totalReceivable: number;
  balance: number;
  totalOverdue: number;
  countOverdue: number;
}

const statusLabel: { [key: string]: string } = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
};

const statusClasses: { [key: string]: string } = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const categoryLabel: { [key: string]: string } = {
  fornecedor: 'Fornecedor',
  marketplace_fee: 'Taxa Marketplace',
  venda: 'Venda',
  outro: 'Outro',
};

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR');
}

export default function FinanceiroPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [notesModal, setNotesModal] = useState<{ isOpen: boolean; notes: string; billId: string }>({
    isOpen: false,
    notes: '',
    billId: '',
  });

  const [formData, setFormData] = useState<FormData>({
    type: 'payable',
    description: '',
    amount: '',
    dueDate: new Date().toISOString().split('T')[0],
    category: 'outro',
    supplierId: '',
    notes: '',
  });

  const [editData, setEditData] = useState<Partial<FormData> | null>(null);

  // Load suppliers on mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await fetch('/api/suppliers');
        if (response.ok) {
          const data = await response.json();
          setSuppliers(data.data);
        }
      } catch (error) {
        console.error('Error loading suppliers:', error);
      }
    };

    fetchSuppliers();
  }, []);

  // Load bills
  const fetchBills = async (pageNum: number = 1) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/bills?page=${pageNum}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setBills(data.data);
        setSummary(data.summary);
      } else {
        setMessage({ type: 'error', text: 'Erro ao carregar contas' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao conectar com servidor' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills(page);
  }, [page]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Conta criada com sucesso!' });
        setFormData({
          type: 'payable',
          description: '',
          amount: '',
          dueDate: new Date().toISOString().split('T')[0],
          category: 'outro',
          supplierId: '',
          notes: '',
        });
        setShowNewForm(false);
        fetchBills(1);
        setPage(1);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao criar conta' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao conectar com servidor' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editData) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/bills/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editData,
          amount: editData.amount ? parseFloat(editData.amount) : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Conta atualizada com sucesso!' });
        setEditingId(null);
        setEditData(null);
        fetchBills(page);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao atualizar conta' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao conectar com servidor' });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/bills/${id}/pay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Conta marcada como paga!' });
        fetchBills(page);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao marcar como paga' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao conectar com servidor' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/bills/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Conta deletada com sucesso!' });
        setDeleteConfirm(null);
        fetchBills(page);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao deletar conta' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao conectar com servidor' });
    } finally {
      setLoading(false);
    }
  };

  const openNotesModal = (notes: string, billId: string) => {
    setNotesModal({ isOpen: true, notes, billId });
  };

  const closeNotesModal = () => {
    setNotesModal({ isOpen: false, notes: '', billId: '' });
  };

  const copyNotes = () => {
    navigator.clipboard.writeText(notesModal.notes);
    setMessage({ type: 'success', text: 'Copiado para clipboard!' });
    setTimeout(() => setMessage(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">💳 Financeiro</h1>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          + Nova Conta
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg mb-6 ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* New Form */}
      {showNewForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Criar Nova Conta</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="payable">A Pagar</option>
                <option value="receivable">A Receber</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Descrição *
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Valor (R$) *
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Vencimento *
              </label>
              <input
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Categoria *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="outro">Outro</option>
                <option value="fornecedor">Fornecedor</option>
                <option value="marketplace_fee">Taxa Marketplace</option>
                <option value="venda">Venda</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fornecedor
              </label>
              <select
                name="supplierId"
                value={formData.supplierId}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Nenhum</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notas
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {loading ? 'Criando...' : '✅ Criar Conta'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition"
              >
                ❌ Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-orange-50 rounded-lg shadow p-6">
            <div className="text-orange-600 text-sm font-semibold mb-2">
              🔴 Total a Pagar
            </div>
            <div className="text-2xl font-bold text-orange-900">
              {formatCurrency(summary.totalPayable)}
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg shadow p-6">
            <div className="text-blue-600 text-sm font-semibold mb-2">
              💙 Total a Receber
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {formatCurrency(summary.totalReceivable)}
            </div>
          </div>

          <div
            className={`rounded-lg shadow p-6 ${
              summary.balance >= 0
                ? 'bg-green-50'
                : 'bg-red-50'
            }`}
          >
            <div
              className={`text-sm font-semibold mb-2 ${
                summary.balance >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              Saldo
            </div>
            <div
              className={`text-2xl font-bold ${
                summary.balance >= 0
                  ? 'text-green-900'
                  : 'text-red-900'
              }`}
            >
              {formatCurrency(summary.balance)}
            </div>
          </div>

          <div className="bg-red-50 rounded-lg shadow p-6">
            <div className="text-red-600 text-sm font-semibold mb-2">
              ⚠️ Vencidas
            </div>
            <div className="text-2xl font-bold text-red-900">
              {summary.countOverdue} ({formatCurrency(summary.totalOverdue)})
            </div>
          </div>
        </div>
      )}

      {/* Bills Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && !bills.length ? (
          <div className="p-6 text-center text-gray-600">Carregando...</div>
        ) : bills.length === 0 ? (
          <div className="p-6 text-center text-gray-600">Nenhuma conta encontrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Vencimento
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Fornecedor
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id} className="border-b border-gray-200 hover:bg-gray-50">
                    {editingId === bill.id ? (
                      <>
                        <td className="px-6 py-3">
                          <input
                            type="date"
                            name="dueDate"
                            value={editData?.dueDate || formatDate(bill.dueDate).split('/').reverse().join('-')}
                            onChange={handleEditInputChange}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            type="text"
                            name="description"
                            value={editData?.description || bill.description}
                            onChange={handleEditInputChange}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <select
                            name="category"
                            value={editData?.category || bill.category}
                            onChange={handleEditInputChange}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          >
                            <option value="outro">Outro</option>
                            <option value="fornecedor">Fornecedor</option>
                            <option value="marketplace_fee">Taxa Marketplace</option>
                            <option value="venda">Venda</option>
                          </select>
                        </td>
                        <td className="px-6 py-3 text-sm font-medium text-gray-900">
                          {bill.type === 'payable' ? 'A Pagar' : 'A Receber'}
                        </td>
                        <td className="px-6 py-3">
                          <input
                            type="number"
                            name="amount"
                            value={editData?.amount || bill.amount}
                            onChange={handleEditInputChange}
                            step="0.01"
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClasses[bill.status]}`}>
                            {statusLabel[bill.status]}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">
                          {bill.supplier?.name || '-'}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdate(bill.id)}
                              disabled={loading}
                              className="text-blue-600 hover:text-blue-900 text-sm font-semibold disabled:opacity-50"
                            >
                              ✅
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-gray-600 hover:text-gray-900 text-sm font-semibold"
                            >
                              ❌
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          {formatDate(bill.dueDate)}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          {bill.description}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">
                          {categoryLabel[bill.category]}
                        </td>
                        <td className="px-6 py-3 text-sm font-medium text-gray-900">
                          {bill.type === 'payable' ? 'A Pagar' : 'A Receber'}
                        </td>
                        <td className="px-6 py-3 text-sm font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{formatCurrency(bill.amount)}</span>
                            {bill.notes && bill.type === 'receivable' && (
                              <button
                                onClick={() => openNotesModal(bill.notes || '', bill.id)}
                                className="cursor-pointer p-1 hover:bg-blue-100 rounded transition"
                              >
                                <Info
                                  size={16}
                                  className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                                />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClasses[bill.status]}`}>
                            {statusLabel[bill.status]}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">
                          {bill.supplier?.name || '-'}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingId(bill.id);
                                setEditData({
                                  description: bill.description,
                                  amount: bill.amount.toString(),
                                  dueDate: bill.dueDate,
                                  category: bill.category,
                                });
                              }}
                              className="text-blue-600 hover:text-blue-900 text-sm font-semibold"
                            >
                              ✏️
                            </button>
                            {bill.status !== 'paid' && bill.status !== 'cancelled' && (
                              <button
                                onClick={() => handleMarkAsPaid(bill.id)}
                                disabled={loading}
                                className="text-green-600 hover:text-green-900 text-sm font-semibold disabled:opacity-50"
                              >
                                ✓
                              </button>
                            )}
                            {deleteConfirm === bill.id ? (
                              <>
                                <button
                                  onClick={() => handleDelete(bill.id)}
                                  disabled={loading}
                                  className="text-red-600 hover:text-red-900 text-sm font-semibold disabled:opacity-50"
                                >
                                  Confirmar
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="text-gray-600 hover:text-gray-900 text-sm font-semibold"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(bill.id)}
                                className="text-red-600 hover:text-red-900 text-sm font-semibold"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-8 flex justify-center gap-2">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
        >
          ← Anterior
        </button>
        <span className="px-4 py-2 text-gray-700">Página {page}</span>
        <button
          onClick={() => setPage(page + 1)}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Próxima →
        </button>
      </div>

      {/* Notes Modal */}
      {notesModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">📝 Detalhes</h2>
              <button
                onClick={closeNotesModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {notesModal.notes}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={copyNotes}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                📋 Copiar
              </button>
              <button
                onClick={closeNotesModal}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
