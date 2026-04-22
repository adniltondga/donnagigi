'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { Info } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Supplier {
  id: string;
  name: string;
}

interface BillProduct {
  id: string;
  name: string;
  productCost: number | null;
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
  productId: string | null;
  product: BillProduct | null;
  notes: string | null;
  productCost: number | null;
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
  productId: string;
  notes: string;
  productCost: string;
  status?: string;
}

interface Summary {
  totalPayable: number;
  totalReceivableBruto: number;
  totalReceivableLiquid: number;
  balanceBruto: number;
  balanceLucroReal: number;
  totalOverdue: number;
  countOverdue: number;
}

const statusLabel: { [key: string]: string } = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
};

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR');
}

export default function FinanceiroPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editModal, setEditModal] = useState<{ isOpen: boolean; bill: Bill | null }>({ isOpen: false, bill: null });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [costCache, setCostCache] = useState<Record<string, { productCost: number | null }>>({});
  const [notesModal, setNotesModal] = useState<{ isOpen: boolean; notes: string; billId: string; productCost?: number | null }>({
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
    productId: '',
    notes: '',
    productCost: '',
  });

  const [editData, setEditData] = useState<Partial<FormData> | null>(null);

  // Load suppliers and variants on mount
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

    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products/variants');
        if (response.ok) {
          const data = await response.json();
          setProducts(data.data || []);
        }
      } catch (error) {
        console.error('Error loading products:', error);
      }
    };

    fetchSuppliers();
    fetchProducts();
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

  // Pré-popular cache com custos dos produtos
  useEffect(() => {
    if (bills.length === 0) return;

    const loadCosts = async () => {
      const cache: Record<string, { productCost: number | null }> = {};

      // Primeiro, usar produtos já relacionados
      for (const bill of bills) {
        if (bill.product) {
          cache[bill.id] = {
            productCost: bill.product.productCost,
          };
        }
      }

      // Depois, buscar produtos para bills que não têm productId
      const billsWithoutProduct = bills.filter(b => !b.product && b.notes && b.type === 'receivable');

      if (billsWithoutProduct.length > 0) {
        // Buscar todos os produtos de uma vez
        try {
          const response = await fetch(`/api/products?limit=1000`);
          const data = await response.json();

          const productMap = new Map(
            data.data?.map((p: any) => [p.mlListingId, p]) || []
          );

          for (const bill of billsWithoutProduct) {
            const match = bill.notes?.match(/Produto\n(MLB)?(\d+)/);
            const mlListingId = match ? `MLB${match[2]}` : null;

            if (mlListingId && productMap.has(mlListingId)) {
              const product = productMap.get(mlListingId) as any;
              cache[bill.id] = {
                productCost: product.productCost,
              };
            }
          }
        } catch (error) {
          console.error('Erro ao buscar produtos:', error);
        }
      }

      setCostCache(cache);
    };

    loadCosts();
  }, [bills]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // Se é productId, puxar os custos automaticamente
    if (name === 'productId' && value) {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          productCost: selectedProduct.productCost ? selectedProduct.productCost.toString() : '',
        }));
        return;
      }
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // Se é productId, puxar os custos automaticamente
    if (name === 'productId' && value && editData) {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        setEditData((prev) => ({
          ...prev,
          [name]: value,
          productCost: selectedProduct.productCost ? selectedProduct.productCost.toString() : '',
        }));
        return;
      }
    }

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
          productId: formData.productId || null,
          productCost: formData.productCost ? parseFloat(formData.productCost) : null,
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
          productId: '',
          notes: '',
          productCost: '',
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

  const handleUpdate = async () => {
    if (!editData || !editModal.bill) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/bills/${editModal.bill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editData,
          amount: editData.amount ? parseFloat(editData.amount) : undefined,
          productId: editData.productId || undefined,
          productCost: editData.productCost ? parseFloat(editData.productCost) : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const extra =
          data?.mlListingId && data?.propagadas > 0
            ? ` Custo aplicado em +${data.propagadas} venda(s) do mesmo anúncio.`
            : data?.mlListingId
            ? ' Custo salvo para próximas vendas deste anúncio.'
            : '';
        setMessage({ type: 'success', text: `Conta atualizada com sucesso!${extra}` });
        closeEditModal();
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

  const openEditModal = (bill: Bill) => {
    setEditData({
      description: bill.description,
      amount: bill.amount.toString(),
      dueDate: bill.dueDate.split('T')[0],
      category: bill.category,
      supplierId: bill.supplierId || '',
      productId: bill.productId || '',
      notes: bill.notes || '',
      productCost: bill.productCost?.toString() || '',
    });
    setEditModal({ isOpen: true, bill });
  };

  const closeEditModal = () => {
    setEditModal({ isOpen: false, bill: null });
    setEditData(null);
  };

  const openNotesModal = async (bill: Bill) => {
    let productCost = bill.productCost;

    // Se não tiver custos salvos, buscar do produto
    if (!productCost && bill.notes) {
      // Extrair itemId das notas (linha "Produto") - pode ter MLB na frente
      const produtoMatch = bill.notes.match(/Produto\n(MLB)?(\d+)/);
      const itemId = produtoMatch ? produtoMatch[2] : null;

      console.log('🔍 Buscando produto:', { itemId });

      if (itemId) {
        try {
          // Buscar pelo itemId com MLB prefix (como está salvo no banco)
          const mlListingId = `MLB${itemId}`;
          const response = await fetch(`/api/products?search=${mlListingId}`);
          const data = await response.json();

          if (data.data && data.data.length > 0) {
            const product = data.data[0];
            productCost = productCost || product.productCost || null;
          }
        } catch (error) {
          console.error('Erro ao buscar produto:', error);
        }
      }
    }

    // Armazenar no cache para usar na coluna LUCRO
    setCostCache(prev => ({
      ...prev,
      [bill.id]: { productCost }
    }));

    setNotesModal({
      isOpen: true,
      notes: bill.notes || '',
      billId: bill.id,
      productCost,
    });
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

            {formData.type === 'receivable' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Produto (opcional)
                </label>
                <select
                  name="productId"
                  value={formData.productId}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Selecionar produto...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} {product.productCost ? `- R$ ${product.productCost.toFixed(2)}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.type === 'receivable' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Custo Mercadoria (R$)
                  </label>
                  <input
                    type="number"
                    name="productCost"
                    value={formData.productCost}
                    onChange={handleInputChange}
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

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
        <>
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
                💙 Total a Receber (Bruto)
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {formatCurrency(summary.totalReceivableBruto)}
              </div>
            </div>

            <div className="bg-blue-100 rounded-lg shadow p-6">
              <div className="text-blue-700 text-sm font-semibold mb-2">
                💎 Total a Receber (Lucro Real)
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {formatCurrency(summary.totalReceivableLiquid)}
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div
              className={`rounded-lg shadow p-6 ${
                summary.balanceBruto >= 0
                  ? 'bg-green-50'
                  : 'bg-red-50'
              }`}
            >
              <div
                className={`text-sm font-semibold mb-2 ${
                  summary.balanceBruto >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                Saldo (Bruto)
              </div>
              <div
                className={`text-2xl font-bold ${
                  summary.balanceBruto >= 0
                    ? 'text-green-900'
                    : 'text-red-900'
                }`}
              >
                {formatCurrency(summary.balanceBruto)}
              </div>
            </div>

            <div
              className={`rounded-lg shadow p-6 ${
                summary.balanceLucroReal >= 0
                  ? 'bg-green-100'
                  : 'bg-red-100'
              }`}
            >
              <div
                className={`text-sm font-semibold mb-2 ${
                  summary.balanceLucroReal >= 0
                    ? 'text-green-700'
                    : 'text-red-700'
                }`}
              >
                Saldo (Lucro Real)
              </div>
              <div
                className={`text-2xl font-bold ${
                  summary.balanceLucroReal >= 0
                    ? 'text-green-900'
                    : 'text-red-900'
                }`}
              >
                {formatCurrency(summary.balanceLucroReal)}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bills Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && !bills.length ? (
          <div className="p-6 text-center text-gray-600">Carregando...</div>
        ) : bills.length === 0 ? (
          <div className="p-6 text-center text-gray-600">Nenhuma conta encontrada</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Lucro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="text-sm">
                      {formatDate(bill.dueDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {bill.description}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {bill.type === 'payable' ? 'A Pagar' : 'A Receber'}
                    </TableCell>
                    <TableCell className="text-sm font-semibold">
                      <div className="flex items-center gap-2">
                        <span>
                          {bill.type === 'receivable' ? (
                            (() => {
                              const brutoMatch = bill.notes?.match(/Bruto:\s*R\$\s*([\d,\.]+)/);
                              if (brutoMatch) {
                                return formatCurrency(parseFloat(brutoMatch[1].replace(',', '.')));
                              }
                              const envioMatch = bill.notes?.match(/Taxa de envio:\s*R\$\s*([\d,\.]+)/);
                              const taxaEnvio = envioMatch ? parseFloat(envioMatch[1].replace(',', '.')) : 0;
                              return formatCurrency(bill.amount + taxaEnvio);
                            })()
                          ) : (
                            formatCurrency(bill.amount)
                          )}
                        </span>
                        {bill.notes && bill.type === 'receivable' && (
                          <button
                            onClick={() => openNotesModal(bill)}
                            className="cursor-pointer p-1 hover:bg-blue-100 rounded transition"
                          >
                            <Info
                              size={16}
                              className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                            />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-semibold">
                      {bill.type === 'receivable' ? (
                        (() => {
                          const vendaMatch = bill.notes?.match(/Taxa de venda:\s*R\$\s*([\d,\.]+)/);
                          const taxaVenda = vendaMatch ? parseFloat(vendaMatch[1].replace(',', '.')) : 0;
                          const envioMatch = bill.notes?.match(/Taxa de envio:\s*R\$\s*([\d,\.]+)/);
                          const taxaEnvio = envioMatch ? parseFloat(envioMatch[1].replace(',', '.')) : 0;

                          // Usar custos do cache (preenchido quando abre modal) ou do bill
                          let prodCost = costCache[bill.id]?.productCost ?? bill.productCost ?? 0;

                          // Bruto: prefere o valor gravado nas notes
                          const brutoMatch = bill.notes?.match(/Bruto:\s*R\$\s*([\d,\.]+)/);
                          const bruto = brutoMatch
                            ? parseFloat(brutoMatch[1].replace(',', '.'))
                            : bill.amount + taxaVenda + taxaEnvio;

                          // Lucro = Bruto - Taxa venda - Taxa envio - Custo
                          const profit = bruto - taxaVenda - taxaEnvio - prodCost;
                          return (
                            <span className={profit > 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatCurrency(profit)}
                            </span>
                          );
                        })()
                      ) : (
                        <span>-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{statusLabel[bill.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {bill.supplier?.name || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => openEditModal(bill)}
                          size="sm"
                          variant="ghost"
                        >
                          ✏️
                        </Button>
                        {bill.status !== 'paid' && bill.status !== 'cancelled' && (
                          <Button
                            onClick={() => handleMarkAsPaid(bill.id)}
                            disabled={loading}
                            size="sm"
                            variant="ghost"
                          >
                            ✓
                          </Button>
                        )}
                        {deleteConfirm === bill.id ? (
                          <>
                            <Button
                              onClick={() => handleDelete(bill.id)}
                              disabled={loading}
                              size="sm"
                              variant="ghost"
                            >
                              Confirmar
                            </Button>
                            <Button
                              onClick={() => setDeleteConfirm(null)}
                              size="sm"
                              variant="ghost"
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => setDeleteConfirm(bill.id)}
                            size="sm"
                            variant="ghost"
                          >
                            🗑️
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
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

            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto space-y-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {notesModal.notes
                  .replace(/MLB(\d+)/g, '$1')
                  .replace(/\nVENDAS\nBruto:.*$/s, '')}
              </p>

              {(() => {
                const brutoMatch = notesModal.notes.match(/Bruto: R\$ ([\d,\.]+)/);
                const bruto = brutoMatch ? parseFloat(brutoMatch[1].replace(',', '.')) : 0;

                const vendaMatch = notesModal.notes.match(/Taxa de venda: R\$ ([\d,\.]+)/);
                const taxaVenda = vendaMatch ? parseFloat(vendaMatch[1].replace(',', '.')) : 0;

                const envioMatch = notesModal.notes.match(/Taxa de envio: R\$ ([\d,\.]+)/);
                const taxaEnvio = envioMatch ? parseFloat(envioMatch[1].replace(',', '.')) : 0;

                const prodCost = notesModal.productCost ?? 0;
                const allTaxes = taxaVenda + taxaEnvio + prodCost;
                const liquidoReal = bruto - allTaxes;

                return (
                  <div className="border-t pt-4 space-y-3">
                    <div className="bg-white rounded p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">💵 Bruto:</span>
                        <span className="font-semibold">{formatCurrency(bruto)}</span>
                      </div>

                      <div className="text-xs text-gray-600 space-y-2 ml-2">
                        {/* Taxa Mercado Livre */}
                        <div className="space-y-1">
                          <div className="font-medium text-gray-700">Taxa Mercado Livre:</div>
                          <div className="flex justify-between ml-2">
                            <span>  • Venda:</span>
                            <span>{formatCurrency(taxaVenda)}</span>
                          </div>
                          <div className="flex justify-between ml-2">
                            <span>  • Envio:</span>
                            <span>{formatCurrency(taxaEnvio)}</span>
                          </div>
                        </div>

                        {/* Custos */}
                        {prodCost > 0 && (
                          <div className="space-y-1">
                            <div className="font-medium text-gray-700">Custos:</div>
                            <div className="flex justify-between ml-2">
                              <span>  • 💰 Mercadoria:</span>
                              <span>{formatCurrency(prodCost)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border-t pt-2 flex justify-between">
                        <span className="font-medium">Total Taxas:</span>
                        <span className="font-semibold text-red-600">{formatCurrency(allTaxes)}</span>
                      </div>

                      <div className="bg-blue-50 rounded p-2 flex justify-between border border-blue-200">
                        <span className="font-bold text-blue-900">📈 Líquido Real:</span>
                        <span className={`font-bold text-lg ${liquidoReal > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(liquidoReal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
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

      {/* Edit Modal */}
      {editModal.isOpen && editModal.bill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">✏️ Editar Conta</h2>
              <button
                onClick={closeEditModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <form className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descrição
                </label>
                <input
                  type="text"
                  name="description"
                  value={editData?.description || ''}
                  onChange={handleEditInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  name="amount"
                  value={editData?.amount || ''}
                  onChange={handleEditInputChange}
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Vencimento
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={editData?.dueDate || ''}
                  onChange={handleEditInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status
                </label>
                <select
                  name="status"
                  value={editData?.status || editModal.bill.status}
                  onChange={handleEditInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="overdue">Vencido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              {editModal.bill.type === 'receivable' && (
                <>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Produto
                    </label>
                    <select
                      name="productId"
                      value={editData?.productId || ''}
                      onChange={handleEditInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Selecionar produto...</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} {product.productCost ? `- R$ ${product.productCost.toFixed(2)}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Custo Mercadoria (R$)
                    </label>
                    <input
                      type="number"
                      name="productCost"
                      value={editData?.productCost || ''}
                      onChange={handleEditInputChange}
                      step="0.01"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notas
                </label>
                <textarea
                  name="notes"
                  value={editData?.notes || ''}
                  onChange={handleEditInputChange}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </form>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {loading ? 'Salvando...' : '✅ Salvar'}
              </button>
              <button
                onClick={closeEditModal}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition"
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
