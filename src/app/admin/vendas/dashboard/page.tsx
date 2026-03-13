'use client';

import { useState, useEffect, useCallback } from 'react';

interface SaleData {
  id: string;
  variantId: string;
  quantity: number;
  salePrice: number;
  marketplace: string;
  unitCost: number;
  totalCost: number;
  totalRevenue: number;
  profit: number;
  profitMargin: number;
  saleDate: string;
  variant: {
    cod: string;
    model: { name: string } | null;
    color: { name: string } | null;
    product: { name: string };
  };
}

interface SummaryData {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalQuantity: number;
}

interface FiltersState {
  startDate: string;
  endDate: string;
  marketplace: string;
  variantId: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('pt-BR');
}

export default function VendasDashboard() {
  const [sales, setSales] = useState<SaleData[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    totalQuantity: 0,
  });

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<SaleData> | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [filters, setFilters] = useState<FiltersState>({
    startDate: '',
    endDate: '',
    marketplace: 'all',
    variantId: '',
  });

  // Carregar vendas
  const fetchSales = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pageNum.toString());
      params.append('limit', '10');

      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.marketplace !== 'all') params.append('marketplace', filters.marketplace);
      if (filters.variantId) params.append('variantId', filters.variantId);

      const response = await fetch(`/api/sales?${params}`);
      const data = await response.json();

      if (data.success) {
        setSales(data.data || []);
        setSummary(data.summary);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSales(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, fetchSales]);

  const handleApplyFilters = () => {
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters({ startDate: '', endDate: '', marketplace: 'all', variantId: '' });
    setPage(1);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirm(id);
  };

  const handleDeleteConfirm = async (id: string) => {
    try {
      const response = await fetch(`/api/sales/${id}`, { method: 'DELETE' });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Venda deletada com sucesso' });
        setDeleteConfirm(null);
        fetchSales(page);
      } else {
        setMessage({ type: 'error', text: 'Erro ao deletar venda' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao conectar com servidor' });
    }
  };

  const handleEditClick = (sale: SaleData) => {
    setEditingId(sale.id);
    setEditData({ ...sale });
  };

  const handleEditSave = async () => {
    if (!editingId || !editData) return;

    try {
      const response = await fetch(`/api/sales/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: editData.quantity,
          salePrice: editData.salePrice,
          marketplace: editData.marketplace,
          saleDate: editData.saleDate,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Venda atualizada com sucesso' });
        setEditingId(null);
        setEditData(null);
        fetchSales(page);
      } else {
        setMessage({ type: 'error', text: 'Erro ao atualizar venda' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao conectar com servidor' });
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">📊 Dashboard de Vendas</h1>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-blue-50 rounded-lg shadow p-6 border-l-4 border-blue-500">
          <p className="text-blue-600 text-sm font-semibold uppercase">Total Faturado</p>
          <p className="text-3xl font-bold text-blue-900 mt-2">{formatCurrency(summary.totalRevenue)}</p>
        </div>

        <div className="bg-orange-50 rounded-lg shadow p-6 border-l-4 border-orange-500">
          <p className="text-orange-600 text-sm font-semibold uppercase">Total de Custos</p>
          <p className="text-3xl font-bold text-orange-900 mt-2">{formatCurrency(summary.totalCost)}</p>
        </div>

        <div
          className={`rounded-lg shadow p-6 border-l-4 ${
            summary.totalProfit >= 0
              ? 'bg-green-50 border-green-500'
              : 'bg-red-50 border-red-500'
          }`}
        >
          <p
            className={`text-sm font-semibold uppercase ${
              summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            Lucro Líquido
          </p>
          <p
            className={`text-3xl font-bold mt-2 ${
              summary.totalProfit >= 0 ? 'text-green-900' : 'text-red-900'
            }`}
          >
            {formatCurrency(summary.totalProfit)}
          </p>
        </div>

        <div className="bg-purple-50 rounded-lg shadow p-6 border-l-4 border-purple-500">
          <p className="text-purple-600 text-sm font-semibold uppercase">Quantidade Vendida</p>
          <p className="text-3xl font-bold text-purple-900 mt-2">{summary.totalQuantity}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">🔍 Filtros</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Data Inicial</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Data Final</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Marketplace</label>
            <select
              value={filters.marketplace}
              onChange={(e) => setFilters({ ...filters, marketplace: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Todos</option>
              <option value="ml">Mercado Livre</option>
              <option value="shopee">Shopee</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleApplyFilters}
            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg transition"
          >
            ✓ Aplicar Filtros
          </button>
          <button
            onClick={handleClearFilters}
            className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-lg transition"
          >
            ✕ Limpar Filtros
          </button>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando vendas...</div>
        ) : sales.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhuma venda encontrada</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-sm font-semibold text-gray-700">
                    <th className="px-6 py-3 text-left">Data</th>
                    <th className="px-6 py-3 text-left">Produto</th>
                    <th className="px-6 py-3 text-left">Variação</th>
                    <th className="px-6 py-3 text-center">Qtd</th>
                    <th className="px-6 py-3 text-left">Marketplace</th>
                    <th className="px-6 py-3 text-right">Preço Unit.</th>
                    <th className="px-6 py-3 text-right">Custo Total</th>
                    <th className="px-6 py-3 text-right">Lucro</th>
                    <th className="px-6 py-3 text-right">Margem %</th>
                    <th className="px-6 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className={`border-b border-gray-200 hover:bg-gray-50 transition ${
                        editingId === sale.id ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        {editingId === sale.id ? (
                          <input
                            type="date"
                            value={editData?.saleDate?.split('T')[0] || ''}
                            onChange={(e) => setEditData({ ...editData, saleDate: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded"
                          />
                        ) : (
                          formatDate(sale.saleDate)
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {sale.variant.product.name}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {sale.variant.model?.name} - {sale.variant.color?.name} ({sale.variant.cod})
                      </td>
                      <td className="px-6 py-4 text-center">
                        {editingId === sale.id ? (
                          <input
                            type="number"
                            min="1"
                            value={editData?.quantity || 0}
                            onChange={(e) => setEditData({ ...editData, quantity: parseInt(e.target.value) })}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                          />
                        ) : (
                          sale.quantity
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === sale.id ? (
                          <select
                            value={editData?.marketplace || ''}
                            onChange={(e) => setEditData({ ...editData, marketplace: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded"
                          >
                            <option value="ml">ML</option>
                            <option value="shopee">Shopee</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                              sale.marketplace === 'ml'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {sale.marketplace === 'ml' ? 'ML' : 'Shopee'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold">
                        {editingId === sale.id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editData?.salePrice || 0}
                            onChange={(e) => setEditData({ ...editData, salePrice: parseFloat(e.target.value) })}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                          />
                        ) : (
                          formatCurrency(sale.salePrice)
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-orange-600">
                        {formatCurrency(sale.totalCost)}
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-semibold ${
                          sale.profit >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(sale.profit)}
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-semibold ${
                          sale.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {sale.profitMargin.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-center">
                        {editingId === sale.id ? (
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={handleEditSave}
                              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        ) : deleteConfirm === sale.id ? (
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleDeleteConfirm(sale.id)}
                              className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="bg-gray-400 hover:bg-gray-500 text-white px-2 py-1 rounded text-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleEditClick(sale)}
                              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteClick(sale.id)}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="bg-gray-400 hover:bg-gray-500 disabled:opacity-50 text-white px-4 py-2 rounded transition"
                >
                  ← Anterior
                </button>

                <span className="text-gray-700 font-semibold">
                  Página {page} de {totalPages}
                </span>

                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="bg-gray-400 hover:bg-gray-500 disabled:opacity-50 text-white px-4 py-2 rounded transition"
                >
                  Próxima →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
