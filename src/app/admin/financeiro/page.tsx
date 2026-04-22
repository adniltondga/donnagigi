'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

interface Supplier {
  id: string;
  name: string;
}

interface Bill {
  id: string;
  type: 'payable' | 'receivable';
  description: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  category: string;
  supplierId: string | null;
  supplier: Supplier | null;
  notes: string | null;
}

interface FormData {
  type: 'payable' | 'receivable';
  description: string;
  amount: string;
  dueDate: string;
  category: string;
  supplierId: string;
  notes: string;
  status?: string;
}

const statusLabel: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
};

const categoryLabel: Record<string, string> = {
  fornecedor: 'Fornecedor',
  marketplace_fee: 'Taxa Marketplace',
  outro: 'Outro',
};

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR');
}

function daysUntil(date: string | Date): number {
  const d = new Date(date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export default function FinanceiroPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [typeFilter, setTypeFilter] = useState<'' | 'payable' | 'receivable'>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');

  const [formData, setFormData] = useState<FormData>({
    type: 'payable',
    description: '',
    amount: '',
    dueDate: new Date().toISOString().split('T')[0],
    category: 'outro',
    supplierId: '',
    notes: '',
  });
  const [editData, setEditData] = useState<FormData | null>(null);

  // Carregar suppliers 1x
  useEffect(() => {
    fetch('/api/suppliers')
      .then((r) => r.ok && r.json())
      .then((d) => d && setSuppliers(d.data || []))
      .catch(() => {});
  }, []);

  // Carregar bills
  const fetchBills = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({
        excludeCategory: 'venda',
        page: String(page),
        limit: '20',
        orderBy: 'dueDate_asc',
      });
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (q) params.set('q', q);
      const res = await fetch(`/api/bills?${params}`);
      const data = await res.json();
      setBills(data.data || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      setMessage({ type: 'error', text: 'Erro ao carregar contas' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, typeFilter, statusFilter, q]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(qInput.trim());
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          supplierId: formData.supplierId || null,
        }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Conta criada!' });
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
        setPage(1);
        fetchBills();
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error || 'Erro ao criar' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro de conexão' });
    } finally {
      setLoading(false);
    }
  };

  const onMarkPaid = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bills/${id}/pay`, { method: 'PATCH' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Conta paga!' });
        fetchBills();
      } else {
        setMessage({ type: 'error', text: 'Erro ao pagar' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro de conexão' });
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Conta deletada' });
        setDeleteConfirm(null);
        fetchBills();
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro' });
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (bill: Bill) => {
    setEditBill(bill);
    setEditData({
      type: bill.type,
      description: bill.description,
      amount: String(bill.amount),
      dueDate: bill.dueDate.split('T')[0],
      category: bill.category,
      supplierId: bill.supplierId || '',
      notes: bill.notes || '',
      status: bill.status,
    });
  };

  const onUpdate = async () => {
    if (!editBill || !editData) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bills/${editBill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editData,
          amount: parseFloat(editData.amount),
          supplierId: editData.supplierId || null,
        }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Atualizado' });
        setEditBill(null);
        setEditData(null);
        fetchBills();
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro' });
    } finally {
      setLoading(false);
    }
  };

  // Stats em cima (apenas das bills carregadas da página atual + filtros atuais)
  // Para stats globais de vencimento, faz query separada quando não tem filtro
  const [summary, setSummary] = useState<{
    payableVencendo7d: { count: number; amount: number };
    payableVencidas: { count: number; amount: number };
    receivablePendente: { count: number; amount: number };
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Busca sem paginação pra calcular stats de manuais
        const res = await fetch('/api/bills?excludeCategory=venda&limit=1000');
        const data = await res.json();
        const all: Bill[] = data.data || [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const in7d = new Date(now);
        in7d.setDate(in7d.getDate() + 7);

        const p7 = all.filter(
          (b) =>
            b.type === 'payable' &&
            b.status === 'pending' &&
            new Date(b.dueDate) >= now &&
            new Date(b.dueDate) <= in7d
        );
        const vencidas = all.filter(
          (b) =>
            b.type === 'payable' &&
            (b.status === 'pending' || b.status === 'overdue') &&
            new Date(b.dueDate) < now
        );
        const rPend = all.filter((b) => b.type === 'receivable' && b.status === 'pending');

        setSummary({
          payableVencendo7d: { count: p7.length, amount: p7.reduce((s, b) => s + b.amount, 0) },
          payableVencidas: {
            count: vencidas.length,
            amount: vencidas.reduce((s, b) => s + b.amount, 0),
          },
          receivablePendente: {
            count: rPend.length,
            amount: rPend.reduce((s, b) => s + b.amount, 0),
          },
        });
      } catch {}
    })();
  }, [bills]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">💳 Financeiro</h1>
          <p className="text-gray-600 text-sm">Contas a pagar e a receber manuais.</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          + Nova Conta
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded mb-4 text-sm ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Cards resumo */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs uppercase text-gray-500">📅 A pagar · 7 dias</p>
            <p className="text-lg font-bold text-amber-600">
              {formatCurrency(summary.payableVencendo7d.amount)}
            </p>
            <p className="text-xs text-gray-500">{summary.payableVencendo7d.count} conta(s)</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs uppercase text-gray-500">⚠️ Vencidas</p>
            <p className="text-lg font-bold text-red-600">
              {formatCurrency(summary.payableVencidas.amount)}
            </p>
            <p className="text-xs text-gray-500">{summary.payableVencidas.count} conta(s)</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs uppercase text-gray-500">💰 A receber</p>
            <p className="text-lg font-bold text-emerald-600">
              {formatCurrency(summary.receivablePendente.amount)}
            </p>
            <p className="text-xs text-gray-500">{summary.receivablePendente.count} conta(s)</p>
          </div>
        </div>
      )}

      {/* Formulário Novo */}
      {showNewForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Nova Conta</h2>
          <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo *</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as 'payable' | 'receivable' })
                }
                className="w-full border rounded px-3 py-2"
              >
                <option value="payable">A Pagar</option>
                <option value="receivable">A Receber</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoria *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="outro">Outro</option>
                <option value="fornecedor">Fornecedor</option>
                <option value="marketplace_fee">Taxa Marketplace</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Descrição *</label>
              <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vencimento *</label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            {formData.category === 'fornecedor' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Fornecedor</label>
                <select
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Nenhum</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Notas</label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2 rounded disabled:opacity-50"
              >
                {loading ? 'Salvando...' : '✅ Criar'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 font-semibold py-2 rounded"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3 items-end">
        <form onSubmit={onSearch} className="flex-1 min-w-[260px] flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Busca</label>
            <input
              type="text"
              placeholder="Descrição, notas..."
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="bg-primary-500 hover:bg-primary-600 text-white px-3 py-2 rounded text-sm">
            Buscar
          </button>
          {q && (
            <button
              type="button"
              onClick={() => {
                setQInput('');
                setQ('');
              }}
              className="bg-gray-200 px-3 py-2 rounded text-sm"
            >
              Limpar
            </button>
          )}
        </form>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setPage(1);
              setTypeFilter(e.target.value as any);
            }}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="payable">A Pagar</option>
            <option value="receivable">A Receber</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="pending">Pendente</option>
            <option value="paid">Pago</option>
            <option value="overdue">Vencido</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

      <div className="mb-2 text-xs text-gray-500">
        {loading ? 'Carregando...' : `${total} conta${total === 1 ? '' : 's'}`}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {bills.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">Nenhuma conta encontrada</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((b) => {
                const diff = daysUntil(b.dueDate);
                const isOverdue = diff < 0 && b.status === 'pending';
                const isSoon = diff >= 0 && diff <= 7 && b.status === 'pending';
                return (
                  <TableRow key={b.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      <div
                        className={
                          isOverdue ? 'text-red-600 font-semibold' : isSoon ? 'text-amber-600' : ''
                        }
                      >
                        {formatDate(b.dueDate)}
                      </div>
                      {b.status === 'pending' && (
                        <div className="text-xs text-gray-500">
                          {diff === 0 ? 'hoje' : diff < 0 ? `${-diff}d atrasado` : `em ${diff}d`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className={b.type === 'payable' ? 'text-red-700' : 'text-emerald-700'}>
                        {b.type === 'payable' ? '↙ ' : '↗ '}
                        {b.description}
                      </div>
                      {b.supplier && (
                        <div className="text-xs text-gray-500 mt-0.5">{b.supplier.name}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {categoryLabel[b.category] || b.category}
                    </TableCell>
                    <TableCell
                      className={`text-sm font-semibold text-right whitespace-nowrap ${
                        b.type === 'payable' ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {formatCurrency(b.amount)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          b.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : b.status === 'cancelled'
                            ? 'bg-red-100 text-red-700 line-through'
                            : isOverdue
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isOverdue ? 'Vencido' : statusLabel[b.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button onClick={() => openEdit(b)} size="sm" variant="ghost" title="Editar">
                          ✏️
                        </Button>
                        {b.status !== 'paid' && b.status !== 'cancelled' && (
                          <Button
                            onClick={() => onMarkPaid(b.id)}
                            disabled={loading}
                            size="sm"
                            variant="ghost"
                            title="Marcar como paga"
                          >
                            ✓
                          </Button>
                        )}
                        {deleteConfirm === b.id ? (
                          <>
                            <Button onClick={() => onDelete(b.id)} size="sm" variant="ghost">
                              Confirmar
                            </Button>
                            <Button onClick={() => setDeleteConfirm(null)} size="sm" variant="ghost">
                              ✕
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => setDeleteConfirm(b.id)}
                            size="sm"
                            variant="ghost"
                            title="Deletar"
                          >
                            🗑️
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Paginação */}
      {pages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            ← Anterior
          </button>
          <span className="px-4 py-2 text-gray-700">
            Página {page} de {pages}
          </span>
          <button
            onClick={() => setPage(Math.min(pages, page + 1))}
            disabled={page === pages}
            className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Próxima →
          </button>
        </div>
      )}

      {/* Modal Edit */}
      {editBill && editData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">✏️ Editar Conta</h2>
              <button
                onClick={() => {
                  setEditBill(null);
                  setEditData(null);
                }}
                className="text-gray-500 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Descrição</label>
                <input
                  type="text"
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editData.amount}
                  onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vencimento</label>
                <input
                  type="date"
                  value={editData.dueDate}
                  onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={editData.status}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <select
                  value={editData.category}
                  onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="outro">Outro</option>
                  <option value="fornecedor">Fornecedor</option>
                  <option value="marketplace_fee">Taxa Marketplace</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Notas</label>
                <textarea
                  rows={3}
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={onUpdate}
                disabled={loading}
                className="bg-primary-500 hover:bg-primary-600 text-white font-semibold px-4 py-2 rounded"
              >
                {loading ? 'Salvando...' : '✅ Salvar'}
              </button>
              <button
                onClick={() => {
                  setEditBill(null);
                  setEditData(null);
                }}
                className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
