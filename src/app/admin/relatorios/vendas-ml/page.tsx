'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { Info, ShoppingCart, DollarSign, TrendingUp, ShoppingBag, Receipt, Download, Loader2 } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ProductLabel } from '@/components/ProductLabel';
import { PeriodFilter, resolvePreset, type PeriodPreset } from '@/components/admin/PeriodFilter';
import { SummaryCard } from '@/components/ui/summary-card';
import { computeSaleNumbers } from '@/lib/sale-notes';

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

function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface PeriodTotals {
  pedidos: number;
  vendas: number; // unidades
  bruto: number;
  taxaVenda: number;
  envio: number;
  custo: number;
  lucro: number;
  ticketMedio: number;
}

function parseNotes(notes: string | null): {
  pedido?: string;
  pack?: string;
  comprador?: string;
  produtoMlb?: string;
  variacao?: string;
} {
  if (!notes) return {};
  const pick = (re: RegExp) => notes.match(re)?.[1]?.trim();
  return {
    pedido: pick(/PEDIDO\s*\n#?([^\n]+)/),
    pack: pick(/Pack\s*\n#?([^\n]+)/),
    comprador: pick(/Comprador\s*\n([^\n]+)/),
    produtoMlb: pick(/Produto\s*\n([^\n]+)/),
    variacao: pick(/Variação\s*\n([^\n]+)/),
  };
}

export default function VendasMLPage() {
  const initialPeriod = resolvePreset('mes');
  const [bills, setBills] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [status, setStatus] = useState<string>('');
  const [from, setFrom] = useState<string>(initialPeriod.from);
  const [to, setTo] = useState<string>(initialPeriod.to);
  const [preset, setPreset] = useState<PeriodPreset>('mes');
  const [notesModal, setNotesModal] = useState<{ isOpen: boolean; bill: Bill | null }>({
    isOpen: false,
    bill: null,
  });
  const [totals, setTotals] = useState<PeriodTotals | null>(null);
  const [totalsLoading, setTotalsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

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
      if (from) params.set('paidFrom', from);
      if (to) params.set('paidTo', to);
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

  const fetchTotals = async () => {
    setTotalsLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/relatorios/v2?${params}`);
      const data = await res.json();
      const k = data?.kpisAtual;
      if (!k) {
        setTotals(null);
        return;
      }
      setTotals({
        pedidos: k.pedidos || 0,
        vendas: k.vendas || 0,
        bruto: k.bruto || 0,
        taxaVenda: k.taxaVenda || 0,
        envio: k.envio || 0,
        custo: k.custo || 0,
        lucro: k.lucro || 0,
        ticketMedio: data?.derivados?.ticketMedio || 0,
      });
    } catch (err) {
      console.error(err);
      setTotals(null);
    } finally {
      setTotalsLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, status, from, to]);

  useEffect(() => {
    fetchTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  useEffect(() => {
    if (!notesModal.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotesModal({ isOpen: false, bill: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notesModal.isOpen]);

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

  const handlePeriodChange = (next: { from: string; to: string; preset: PeriodPreset }) => {
    setFrom(next.from);
    setTo(next.to);
    setPreset(next.preset);
    setPage(1);
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        category: 'venda',
        page: '1',
        limit: '10000',
        orderBy: 'paidDate_desc',
      });
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      if (from) params.set('paidFrom', from);
      if (to) params.set('paidTo', to);
      const res = await fetch(`/api/bills?${params}`);
      const data = await res.json();
      const rows: Bill[] = data.data || [];

      const csvEscape = (val: string | number | null | undefined): string => {
        if (val == null) return '';
        const str = String(val);
        return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      };
      const headers = [
        'Data da venda',
        'Libera em',
        'Pedido',
        'Pack',
        'Comprador',
        'Anúncio MLB',
        'Variação',
        'Quantidade',
        'Bruto',
        'Taxa de venda',
        'Taxa de envio',
        'Custo mercadoria',
        'Líquido',
        'Status',
      ];
      const lines = [headers.map(csvEscape).join(';')];
      for (const b of rows) {
        const meta = parseNotes(b.notes);
        const s = computeSaleNumbers(b);
        const orderId = meta.pedido || b.mlOrderId?.replace(/^order_/, '') || '';
        lines.push(
          [
            b.paidDate ? new Date(b.paidDate).toLocaleString('pt-BR') : '',
            b.dueDate ? new Date(b.dueDate).toLocaleDateString('pt-BR') : '',
            orderId,
            meta.pack || b.mlPackId || '',
            meta.comprador || '',
            meta.produtoMlb || '',
            meta.variacao || '',
            b.quantity,
            s.bruto.toFixed(2).replace('.', ','),
            s.taxaVenda.toFixed(2).replace('.', ','),
            s.envio.toFixed(2).replace('.', ','),
            s.custo.toFixed(2).replace('.', ','),
            s.liquido.toFixed(2).replace('.', ','),
            statusLabel[b.status] || b.status,
          ]
            .map(csvEscape)
            .join(';')
        );
      }

      // BOM pra Excel reconhecer UTF-8 no Windows
      const csv = '﻿' + lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vendas-ml_${from}_a_${to}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('export CSV falhou:', err);
      alert('Erro ao exportar CSV. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="🛒 Vendas Mercado Livre"
        description="Listagem de todas as vendas importadas do ML. Clique numa linha para ver o detalhamento."
        actions={
          <button
            onClick={exportCSV}
            disabled={exporting || total === 0}
            className="inline-flex items-center gap-2 border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-foreground font-medium px-3 py-2 rounded-lg text-sm"
            title="Baixa um CSV com as vendas do filtro atual (até 10.000 linhas)"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Gerando...' : 'Exportar CSV'}
          </button>
        }
      />

      {/* Período */}
      <Card className="p-4">
        <PeriodFilter from={from} to={to} preset={preset} onChange={handlePeriodChange} />
      </Card>

      {/* Totais do período */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Bruto"
          value={totals?.bruto ?? 0}
          sub="vendas no período"
          icon={DollarSign}
          tone="emerald"
          loading={totalsLoading}
        />
        <SummaryCard
          label="Taxas + custo"
          value={(totals?.taxaVenda ?? 0) + (totals?.envio ?? 0) + (totals?.custo ?? 0)}
          sub={
            totals
              ? `venda ${formatCurrency(totals.taxaVenda)} · envio ${formatCurrency(totals.envio)} · custo ${formatCurrency(totals.custo)}`
              : '—'
          }
          icon={Receipt}
          tone="amber"
          loading={totalsLoading}
        />
        <SummaryCard
          label="Lucro"
          value={totals?.lucro ?? 0}
          sub={
            totals && totals.bruto > 0
              ? `${((totals.lucro / totals.bruto) * 100).toFixed(1)}% de margem`
              : 'sem vendas'
          }
          icon={TrendingUp}
          tone={totals && totals.lucro < 0 ? 'rose' : 'primary'}
          loading={totalsLoading}
        />
        <SummaryCard
          label="Vendas"
          value={
            totals
              ? `${totals.pedidos} venda${totals.pedidos === 1 ? '' : 's'}`
              : '—'
          }
          sub={
            totals && totals.pedidos > 0
              ? `ticket médio ${formatCurrency(totals.ticketMedio)}`
              : 'nenhuma venda'
          }
          icon={ShoppingBag}
          tone="sky"
          tooltip={
            totals
              ? `${totals.vendas} unidade${totals.vendas === 1 ? '' : 's'} vendida${totals.vendas === 1 ? '' : 's'}`
              : undefined
          }
          loading={totalsLoading}
        />
      </div>

      {/* Filtros */}
      <Card className="p-4 flex flex-wrap gap-4 items-end">
        <form onSubmit={onSearch} className="flex-1 min-w-[280px] flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground mb-1">Busca</label>
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
              className="bg-gray-200 hover:bg-gray-300 text-foreground px-3 py-2 rounded"
            >
              Limpar
            </button>
          )}
        </form>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Status</label>
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
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </Card>

      <div className="text-sm text-muted-foreground">
        {loading ? 'Carregando...' : `${total} venda${total === 1 ? '' : 's'} encontrada${total === 1 ? '' : 's'}`}
      </div>

      {/* Tabela */}
      <Card className="overflow-x-auto">
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
                const s = computeSaleNumbers(b);
                return (
                  <TableRow
                    key={b.id}
                    onClick={() => setNotesModal({ isOpen: true, bill: b })}
                    className="cursor-pointer hover:bg-accent transition"
                  >
                    <TableCell className="text-sm whitespace-nowrap">
                      {b.paidDate ? (
                        <div>
                          <div>{formatDate(b.paidDate)}</div>
                          <div className="text-xs text-muted-foreground">{formatTime(b.paidDate)}</div>
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      {formatDate(b.dueDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <ProductLabel description={b.description} quantity={b.quantity} />
                      {b.mlPackId && (
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">Pack #{b.mlPackId}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-right whitespace-nowrap">
                      <div className="flex items-center gap-2 justify-end">
                        <span>{formatCurrency(s.bruto)}</span>
                        <Info size={14} className="text-muted-foreground shrink-0" />
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-sm font-semibold text-right whitespace-nowrap ${
                        s.lucro > 0 ? 'text-emerald-600' : s.lucro < 0 ? 'text-red-600' : 'text-muted-foreground'
                      }`}
                    >
                      {formatCurrency(s.lucro)}
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
            className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-accent"
          >
            ← Anterior
          </button>
          <span className="px-4 py-2 text-foreground">
            Página {page} de {pages}
          </span>
          <button
            onClick={() => setPage(Math.min(pages, page + 1))}
            disabled={page === pages}
            className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-accent"
          >
            Próxima →
          </button>
        </div>
      )}

      {/* Notes Modal */}
      {notesModal.isOpen && notesModal.bill && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setNotesModal({ isOpen: false, bill: null })}
        >
          <div
            className="bg-card rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">📝 Detalhes da venda</h2>
              <button
                onClick={() => setNotesModal({ isOpen: false, bill: null })}
                className="text-muted-foreground hover:text-foreground text-2xl leading-none"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            {(() => {
              const b = notesModal.bill!;
              const meta = parseNotes(b.notes);
              const s = computeSaleNumbers(b);
              const orderId = meta.pedido || b.mlOrderId?.replace(/^order_/, '');
              const mlbId = meta.produtoMlb;
              return (
                <>
                  {/* Identificação */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {orderId && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Pedido</div>
                        <a
                          href={`https://www.mercadolivre.com.br/vendas/${orderId}/detalhe`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-foreground hover:text-primary-700"
                        >
                          #{orderId}
                        </a>
                      </div>
                    )}
                    {(meta.pack || b.mlPackId) && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Pack</div>
                        <span className="font-mono text-foreground">#{meta.pack || b.mlPackId}</span>
                      </div>
                    )}
                    {meta.comprador && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Comprador</div>
                        <span className="text-foreground">{meta.comprador}</span>
                      </div>
                    )}
                    {mlbId && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Anúncio</div>
                        <a
                          href={`https://produto.mercadolivre.com.br/${mlbId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-foreground hover:text-primary-700"
                        >
                          {mlbId}
                        </a>
                      </div>
                    )}
                    {meta.variacao && (
                      <div className="sm:col-span-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Variação</div>
                        <span className="text-foreground">{meta.variacao}</span>
                      </div>
                    )}
                  </div>

                  {/* Cálculo */}
                  <div className="bg-card border rounded-lg p-4 space-y-2 text-sm">
                    {b.quantity > 1 && (
                      <div className="flex justify-between text-amber-700">
                        <span className="font-medium">📦 Quantidade:</span>
                        <span className="font-semibold">{b.quantity} unidades</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="font-medium">💵 Bruto:</span>
                      <span className="font-semibold">{formatCurrency(s.bruto)}</span>
                    </div>
                    <div className="flex justify-between text-amber-700">
                      <span>  • Taxa de venda:</span>
                      <span>{formatCurrency(s.taxaVenda)}</span>
                    </div>
                    <div className="flex justify-between text-amber-700">
                      <span>  • Taxa de envio:</span>
                      <span>{formatCurrency(s.envio)}</span>
                    </div>
                    {s.custo > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>  • 💰 Custo mercadoria:</span>
                        <span>{formatCurrency(s.custo)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-medium">Total taxas + custo:</span>
                      <span className="font-semibold text-red-600">{formatCurrency(s.totalTaxas)}</span>
                    </div>
                    <div className="bg-blue-50 rounded p-2 flex justify-between border border-blue-200">
                      <span className="font-bold text-blue-900">📈 Líquido real:</span>
                      <span className={`font-bold text-lg ${s.liquido > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(s.liquido)}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
