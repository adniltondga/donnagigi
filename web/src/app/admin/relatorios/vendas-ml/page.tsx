'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { Info, ShoppingCart } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

interface Bill {
  id: string;
  type: string;
  description: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
  category: string;
  notes: string | null;
  productCost: number | null;
  mlOrderId: string | null;
  mlPackId: string | null;
  quantity: number;
}

const statusLabel: Record<string, string> = {
  pending: 'A Receber',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
};

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR');
}

export default function VendasMLPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [status, setStatus] = useState<string>('');
  const [notesModal, setNotesModal] = useState<{ isOpen: boolean; bill: Bill | null }>({
    isOpen: false,
    bill: null,
  });

  const fetchBills = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category: 'venda',
        page: String(page),
        limit: '20',
        orderBy: 'paidDate_desc',
      });
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      const res = await fetch(`/api/bills?${params}`);
      const data = await res.json();
      setBills(data.data || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, status]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(qInput.trim());
  };

  const clearSearch = () => {
    setQInput('');
    setQ('');
    setPage(1);
  };

  const bruto = (b: Bill): number => {
    const m = b.notes?.match(/Bruto:\s*R\$\s*([\d,\.]+)/);
    if (m) return parseFloat(m[1].replace(',', '.'));
    const e = b.notes?.match(/Taxa de envio:\s*R\$\s*([\d,\.]+)/);
    const envio = e ? parseFloat(e[1].replace(',', '.')) : 0;
    return b.amount + envio;
  };

  const lucro = (b: Bill): number => {
    const v = b.notes?.match(/Taxa de venda:\s*R\$\s*([\d,\.]+)/);
    const e = b.notes?.match(/Taxa de envio:\s*R\$\s*([\d,\.]+)/);
    const taxaVenda = v ? parseFloat(v[1].replace(',', '.')) : 0;
    const taxaEnvio = e ? parseFloat(e[1].replace(',', '.')) : 0;
    return bruto(b) - taxaVenda - taxaEnvio - (b.productCost || 0);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="🛒 Vendas Mercado Livre"
        description="Listagem de todas as vendas importadas do ML. Clique no ícone ℹ️ para ver o detalhamento de taxas."
      />

      {/* Filtros */}
      <Card className="p-4 flex flex-wrap gap-4 items-end">
        <form onSubmit={onSearch} className="flex-1 min-w-[280px] flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Busca</label>
            <input
              type="text"
              placeholder="Descrição, MLB, order_id, pack_id, comprador…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <button
            type="submit"
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded font-semibold"
          >
            Buscar
          </button>
          {q && (
            <button
              type="button"
              onClick={clearSearch}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded"
            >
              Limpar
            </button>
          )}
        </form>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="border rounded px-3 py-2"
          >
            <option value="">Todos</option>
            <option value="pending">A Receber</option>
            <option value="paid">Pago</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </Card>

      <div className="text-sm text-gray-600">
        {loading ? 'Carregando...' : `${total} venda${total === 1 ? '' : 's'} encontrada${total === 1 ? '' : 's'}`}
      </div>

      {/* Tabela */}
      <Card className="overflow-hidden">
        {bills.length === 0 && !loading ? (
          <EmptyState icon={ShoppingCart} title="Nenhuma venda encontrada" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venda</TableHead>
                <TableHead>Libera em</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((b) => {
                const l = lucro(b);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {b.paidDate ? formatDate(b.paidDate) : '—'}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-gray-600">
                      {formatDate(b.dueDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{b.description}</div>
                      {b.mlPackId && (
                        <div className="text-xs text-gray-500 font-mono mt-0.5">Pack #{b.mlPackId}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-right whitespace-nowrap">
                      <div className="flex items-center gap-2 justify-end">
                        <span>{formatCurrency(bruto(b))}</span>
                        {b.notes && (
                          <button
                            onClick={() => setNotesModal({ isOpen: true, bill: b })}
                            className="p-1 hover:bg-blue-100 rounded transition"
                            title="Ver detalhes"
                          >
                            <Info size={16} className="text-blue-500" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-sm font-semibold text-right whitespace-nowrap ${
                        l > 0 ? 'text-emerald-600' : l < 0 ? 'text-red-600' : 'text-gray-400'
                      }`}
                    >
                      {formatCurrency(l)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          b.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : b.status === 'cancelled'
                            ? 'bg-red-100 text-red-700 line-through'
                            : b.status === 'overdue'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {statusLabel[b.status] || b.status}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Paginação */}
      {pages > 1 && (
        <div className="flex justify-center gap-2">
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

      {/* Notes Modal */}
      {notesModal.isOpen && notesModal.bill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">📝 Detalhes da venda</h2>
              <button
                onClick={() => setNotesModal({ isOpen: false, bill: null })}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {(notesModal.bill.notes || '').replace(/\n*VENDAS\n.*$/s, '').trim()}
              </pre>
            </div>
            {(() => {
              const b = notesModal.bill!;
              const br = bruto(b);
              const v = b.notes?.match(/Taxa de venda:\s*R\$\s*([\d,\.]+)/);
              const e = b.notes?.match(/Taxa de envio:\s*R\$\s*([\d,\.]+)/);
              const taxaVenda = v ? parseFloat(v[1].replace(',', '.')) : 0;
              const taxaEnvio = e ? parseFloat(e[1].replace(',', '.')) : 0;
              const custo = b.productCost || 0;
              const totalTaxas = taxaVenda + taxaEnvio + custo;
              const liquido = br - totalTaxas;
              return (
                <div className="bg-white border rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">💵 Bruto:</span>
                    <span className="font-semibold">{formatCurrency(br)}</span>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span>  • Taxa de venda:</span>
                    <span>{formatCurrency(taxaVenda)}</span>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span>  • Taxa de envio:</span>
                    <span>{formatCurrency(taxaEnvio)}</span>
                  </div>
                  {custo > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>  • 💰 Custo mercadoria:</span>
                      <span>{formatCurrency(custo)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-medium">Total taxas + custo:</span>
                    <span className="font-semibold text-red-600">{formatCurrency(totalTaxas)}</span>
                  </div>
                  <div className="bg-blue-50 rounded p-2 flex justify-between border border-blue-200">
                    <span className="font-bold text-blue-900">📈 Líquido real:</span>
                    <span className={`font-bold text-lg ${liquido > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(liquido)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
