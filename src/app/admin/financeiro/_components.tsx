'use client';

import { useEffect, useMemo, useState } from 'react';
import { feedback } from '@/lib/feedback';
import {
  AlertTriangle,
  Wallet,
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Pencil,
  Check,
  X as XIcon,
  Loader,
  MoreHorizontal,
} from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useUserRole } from '@/lib/useUserRole';
import CurrencyInput from '@/components/CurrencyInput';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { PeriodFilter, resolvePreset, type PeriodPreset } from '@/components/admin/PeriodFilter';

export type BillType = 'payable' | 'receivable';
export type BillsTabType = BillType | 'all';

interface Supplier {
  id: string;
  name: string;
}
interface BillCategoryMini {
  id: string;
  name: string;
  parent: { id: string; name: string } | null;
}
interface Bill {
  id: string;
  type: BillType;
  description: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  category: string;
  billCategoryId: string | null;
  billCategory: BillCategoryMini | null;
  supplierId: string | null;
  supplier: Supplier | null;
  notes: string | null;
}

export interface CategoryNode {
  id: string;
  name: string;
  type: BillType;
  parentId: string | null;
  children: CategoryNode[];
  _count: { bills: number; children: number };
}

const statusLabel: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
};

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR');
}

/* ============================================================
   FilterCard — card clicável com botão "+" no canto pra criar
   ============================================================ */

const FILTER_TONES: Record<'rose' | 'emerald', { ring: string; addBtn: string; iconBg: string; valueColor: string; labelColor: string }> = {
  rose: {
    ring: 'ring-2 ring-rose-500 dark:ring-rose-400',
    addBtn: 'text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/40',
    iconBg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    valueColor: 'text-foreground',
    labelColor: 'text-rose-700 dark:text-rose-400',
  },
  emerald: {
    ring: 'ring-2 ring-emerald-500 dark:ring-emerald-400',
    addBtn: 'text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40',
    iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    valueColor: 'text-foreground',
    labelColor: 'text-emerald-700 dark:text-emerald-400',
  },
};

function FilterCard({
  label,
  value,
  sub,
  accent,
  active,
  onSelect,
  onAdd,
  addTitle,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: 'rose' | 'emerald';
  active: boolean;
  onSelect: () => void;
  onAdd?: () => void;
  addTitle?: string;
}) {
  const t = FILTER_TONES[accent];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`relative bg-card text-card-foreground rounded-xl border border-border shadow-sm p-5 cursor-pointer hover:shadow-md transition select-none ${
        active ? t.ring : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 pr-8">
        <div className="min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wide ${t.labelColor}`}>{label}</p>
          <p className={`text-2xl font-bold mt-2 ${t.valueColor}`}>{value}</p>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </div>
      </div>
      {onAdd && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className={`absolute top-3 right-3 p-1.5 rounded-full transition ${t.addBtn}`}
          title={addTitle}
          aria-label={addTitle}
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* ============================================================
   Contas a pagar / Contas a receber
   ============================================================ */

export function BillsTab({ initialFilter }: { initialFilter?: BillType } = {}) {
  const { canWrite } = useUserRole();
  const initialPeriod = useMemo(() => resolvePreset('mes'), []);
  const [bills, setBills] = useState<Bill[]>([]);
  const [catsPayable, setCatsPayable] = useState<CategoryNode[]>([]);
  const [catsReceivable, setCatsReceivable] = useState<CategoryNode[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  // typeFilter null = mostra tudo; clicar nos cards "A pagar"/"A receber"
  // alterna entre filtrado e todos.
  const [typeFilter, setTypeFilter] = useState<BillType | null>(initialFilter ?? null);
  const [from, setFrom] = useState<string>(initialPeriod.from);
  const [to, setTo] = useState<string>(initialPeriod.to);
  const [preset, setPreset] = useState<PeriodPreset>('mes');
  const [formType, setFormType] = useState<BillType | null>(null);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        excludeCategory: 'venda',
        page: String(page),
        limit: '20',
        orderBy: 'dueDate_asc',
      });
      if (typeFilter) params.set('type', typeFilter);
      if (from) params.set('dueFrom', from);
      if (to) params.set('dueTo', to);
      const res = await fetch(`/api/bills?${params}`);
      const data = await res.json();
      setBills(data.data || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    await Promise.all([
      fetch('/api/bill-categories?type=payable')
        .then((r) => (r.ok ? r.json() : { categories: [] }))
        .then((d) => setCatsPayable(d.categories || [])),
      fetch('/api/bill-categories?type=receivable')
        .then((r) => (r.ok ? r.json() : { categories: [] }))
        .then((d) => setCatsReceivable(d.categories || [])),
    ]);
  };

  const toggleTypeFilter = (next: BillType) => {
    setPage(1);
    setTypeFilter((curr) => (curr === next ? null : next));
  };

  const handlePeriodChange = (next: { from: string; to: string; preset: PeriodPreset }) => {
    setFrom(next.from);
    setTo(next.to);
    setPreset(next.preset);
    setPage(1);
  };

  useEffect(() => {
    loadCategories();
  }, []);
  useEffect(() => {
    fetchBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, typeFilter, from, to]);

  const onMarkPaid = async (id: string) => {
    const res = await fetch(`/api/bills/${id}/pay`, { method: 'PATCH' });
    if (res.ok) {
      feedback.success('Conta paga!');
      fetchBills();
    }
  };

  const onDelete = async (id: string) => {
    const res = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
    if (res.ok) {
      feedback.success('Conta deletada');
      setDeleteConfirm(null);
      fetchBills();
    }
  };

  const summary = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);

    let proximasCount = 0, proximasAmount = 0;
    let vencidasCount = 0, vencidasAmount = 0;
    let pendentesCount = 0, pendentesAmount = 0;
    let pagarPend = 0, receberPend = 0;

    for (const b of bills) {
      if (b.status !== 'pending') continue;
      const due = new Date(b.dueDate);
      due.setHours(0, 0, 0, 0);
      pendentesCount++;
      pendentesAmount += b.amount;
      if (b.type === 'payable') pagarPend += b.amount;
      else receberPend += b.amount;
      if (due < now) {
        vencidasCount++;
        vencidasAmount += b.amount;
      } else if (due <= in7) {
        proximasCount++;
        proximasAmount += b.amount;
      }
    }
    return {
      proximasCount, proximasAmount, vencidasCount, vencidasAmount, pendentesCount, pendentesAmount,
      pagarPend, receberPend, saldo: receberPend - pagarPend,
    };
  }, [bills]);

  const emptyLabel = typeFilter === 'payable'
    ? 'Nenhuma conta a pagar'
    : typeFilter === 'receivable'
    ? 'Nenhuma conta a receber'
    : 'Nenhuma conta cadastrada';

  const formCategories = formType === 'payable' ? catsPayable : catsReceivable;
  const editCategories = editBill?.type === 'payable' ? catsPayable : catsReceivable;

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <PeriodFilter from={from} to={to} preset={preset} onChange={handlePeriodChange} />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FilterCard
          label="Total a pagar"
          value={formatCurrency(summary.pagarPend)}
          sub="clique para filtrar"
          accent="rose"
          active={typeFilter === 'payable'}
          onSelect={() => toggleTypeFilter('payable')}
          onAdd={canWrite ? () => setFormType('payable') : undefined}
          addTitle="Nova conta a pagar"
        />
        <FilterCard
          label="Total a receber"
          value={formatCurrency(summary.receberPend)}
          sub="clique para filtrar"
          accent="emerald"
          active={typeFilter === 'receivable'}
          onSelect={() => toggleTypeFilter('receivable')}
          onAdd={canWrite ? () => setFormType('receivable') : undefined}
          addTitle="Nova conta a receber"
        />
        <StatCard
          label="Saldo do período"
          value={formatCurrency(summary.saldo)}
          sub="receber − pagar"
          icon={summary.saldo >= 0 ? Wallet : AlertTriangle}
          accent={summary.saldo >= 0 ? 'emerald' : 'rose'}
        />
      </div>

      {/* Modais de criação/edição */}
      <Dialog open={!!formType} onOpenChange={(o) => !o && setFormType(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {formType === 'payable' ? 'Nova conta a pagar' : 'Nova conta a receber'}
            </DialogTitle>
          </DialogHeader>
          {formType && (
            <BillForm
              type={formType}
              categories={formCategories}
              onCategoriesChange={loadCategories}
              onCancel={() => setFormType(null)}
              onSaved={() => {
                setFormType(null);
                setPage(1);
                fetchBills();
                feedback.success('Conta criada');
              }}
              embedded
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deletar conta?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Essa ação não pode ser desfeita. A conta vai ser removida permanentemente.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => deleteConfirm && onDelete(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Deletar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editBill} onOpenChange={(o) => !o && setEditBill(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar conta</DialogTitle>
          </DialogHeader>
          {editBill && (
            <BillForm
              type={editBill.type}
              bill={editBill}
              categories={editCategories}
              onCategoriesChange={loadCategories}
              onCancel={() => setEditBill(null)}
              onSaved={() => {
                setEditBill(null);
                fetchBills();
                feedback.success('Conta atualizada');
              }}
              embedded
            />
          )}
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            Carregando...
          </div>
        ) : bills.length === 0 ? (
          <EmptyState icon={FileText} title={emptyLabel} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {!typeFilter && <TableHead>Tipo</TableHead>}
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((b) => {
                const isOverdue =
                  b.status === 'pending' && new Date(b.dueDate) < new Date(new Date().toDateString());
                const catLabel = b.billCategory
                  ? b.billCategory.parent
                    ? `${b.billCategory.parent.name} · ${b.billCategory.name}`
                    : b.billCategory.name
                  : b.category || '—';
                return (
                  <TableRow key={b.id}>
                    {!typeFilter && (
                      <TableCell className="text-xs whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold ${
                            b.type === 'payable'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          }`}
                        >
                          {b.type === 'payable' ? '↓ Saída' : '↑ Entrada'}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-sm whitespace-nowrap">{formatDate(b.dueDate)}</TableCell>
                    <TableCell className="text-sm">{b.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b.billCategory ? (
                        <span className="inline-block text-xs text-primary-700 bg-primary-50 border border-primary-100 rounded px-1.5 py-0.5">
                          {catLabel}
                        </span>
                      ) : (
                        catLabel
                      )}
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
                      <div className="flex justify-end">
                        {canWrite && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" title="Ações" aria-label="Ações">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setEditBill(b)}>
                                <Pencil className="w-4 h-4" />
                                Editar
                              </DropdownMenuItem>
                              {b.status !== 'paid' && b.status !== 'cancelled' && (
                                <DropdownMenuItem onSelect={() => onMarkPaid(b.id)}>
                                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  {b.type === 'payable' ? 'Marcar como paga' : 'Marcar como recebida'}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem danger onSelect={() => setDeleteConfirm(b.id)}>
                                <Trash2 className="w-4 h-4" />
                                Deletar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {pages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          <Button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} variant="outline" size="sm">
            ← Anterior
          </Button>
          <span className="px-4 py-2 text-foreground">
            Página {page} de {pages} · {total} conta(s)
          </span>
          <Button
            onClick={() => setPage(Math.min(pages, page + 1))}
            disabled={page === pages}
            variant="outline"
            size="sm"
          >
            Próxima →
          </Button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Form de Bill (criar e editar) — cascata de categorias
   ============================================================ */

function BillForm({
  type,
  bill,
  categories,
  onSaved,
  onCancel,
  onCategoriesChange,
  embedded,
}: {
  type: BillType;
  bill?: Bill;
  categories: CategoryNode[];
  onSaved: () => void;
  onCancel: () => void;
  /** Callback chamada após criar uma categoria/subcategoria inline; pai
   * deve refazer fetch para refletir no select. */
  onCategoriesChange?: () => Promise<void> | void;
  /** Quando renderizado dentro de Dialog, omite o Card/CardHeader externo. */
  embedded?: boolean;
}) {
  const editing = !!bill;
  const [rootId, setRootId] = useState<string>(() => {
    if (bill?.billCategory?.parent) return bill.billCategory.parent.id;
    if (bill?.billCategory && !bill.billCategory.parent) return bill.billCategory.id;
    return '';
  });
  const [subId, setSubId] = useState<string>(() => {
    if (bill?.billCategory?.parent) return bill.billCategory.id;
    return '';
  });
  const [amount, setAmount] = useState<string>(bill ? String(bill.amount) : '');
  const [dueDate, setDueDate] = useState<string>(
    bill ? bill.dueDate.split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<string>(bill?.status || 'pending');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Criação inline de categoria
  const [showNewRoot, setShowNewRoot] = useState(false);
  const [showNewSub, setShowNewSub] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  const rootCat = categories.find((c) => c.id === rootId);
  const subs = rootCat?.children || [];

  useEffect(() => {
    if (!bill) setSubId('');
  }, [rootId, bill]);

  const createCategory = async (asSub: boolean) => {
    const name = newCatName.trim();
    if (!name) return;
    setCreatingCat(true);
    try {
      const res = await fetch('/api/bill-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          parentId: asSub ? rootId : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || 'Erro ao criar categoria');
        return;
      }
      const created = await res.json();
      await onCategoriesChange?.();
      // Auto-seleciona a nova
      if (asSub) {
        setSubId(created.id);
        setShowNewSub(false);
      } else {
        setRootId(created.id);
        setSubId('');
        setShowNewRoot(false);
      }
      setNewCatName('');
      setErr(null);
    } catch {
      setErr('Erro de conexão');
    } finally {
      setCreatingCat(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!rootId) {
      setErr('Selecione uma categoria');
      return;
    }
    const categoryId = subId || rootId;
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErr('Valor inválido');
      return;
    }

    setSaving(true);
    try {
      const url = editing ? `/api/bills/${bill!.id}` : '/api/bills';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          billCategoryId: categoryId,
          amount: parsedAmount,
          dueDate,
          ...(editing ? { status } : {}),
        }),
      });
      if (res.ok) {
        onSaved();
      } else {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || 'Erro ao salvar');
      }
    } catch {
      setErr('Erro de conexão');
    } finally {
      setSaving(false);
    }
  };

  const inner = (
    <>
      {categories.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          Nenhuma categoria cadastrada. Clique em <strong>&ldquo;Gerenciar categorias&rdquo;</strong> no topo da página e crie uma primeiro.
        </div>
        ) : (
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
              {showNewRoot ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); createCategory(false); }
                      if (e.key === 'Escape') { setShowNewRoot(false); setNewCatName(''); }
                    }}
                    placeholder="Nome da categoria"
                    className="flex-1 border rounded-lg px-3 py-2"
                  />
                  <Button type="button" size="icon" onClick={() => createCategory(false)} disabled={creatingCat} title="Criar">
                    {creatingCat ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </Button>
                  <Button type="button" size="icon" variant="outline" onClick={() => { setShowNewRoot(false); setNewCatName(''); }} title="Cancelar">
                    <XIcon className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <SearchableSelect
                    value={rootId}
                    onChange={setRootId}
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="Buscar categoria..."
                    emptyText="Nenhuma categoria encontrada"
                    required
                    className="flex-1"
                  />
                  <Button type="button" size="icon" variant="outline" onClick={() => setShowNewRoot(true)} title="Criar nova categoria">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Subcategoria <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              {showNewSub ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); createCategory(true); }
                      if (e.key === 'Escape') { setShowNewSub(false); setNewCatName(''); }
                    }}
                    placeholder="Nome da subcategoria"
                    className="flex-1 border rounded-lg px-3 py-2"
                  />
                  <Button type="button" size="icon" onClick={() => createCategory(true)} disabled={creatingCat || !rootId} title="Criar">
                    {creatingCat ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </Button>
                  <Button type="button" size="icon" variant="outline" onClick={() => { setShowNewSub(false); setNewCatName(''); }} title="Cancelar">
                    <XIcon className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <SearchableSelect
                    value={subId}
                    onChange={setSubId}
                    options={subs.map((s) => ({ value: s.id, label: s.name }))}
                    placeholder={
                      !rootId
                        ? 'Escolha categoria primeiro'
                        : subs.length === 0
                        ? 'Sem subcategorias'
                        : 'Buscar subcategoria...'
                    }
                    emptyText="Nenhuma subcategoria encontrada"
                    disabled={!rootId || subs.length === 0}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setShowNewSub(true)}
                    disabled={!rootId}
                    title={rootId ? 'Criar subcategoria' : 'Escolha a categoria primeiro'}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Valor (R$)</label>
              <CurrencyInput
                value={amount === '' ? 0 : parseFloat(amount)}
                onChange={(v) => setAmount(v > 0 ? String(v) : '')}
                placeholder="R$ 0,00"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Vencimento</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            {editing && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                  <option value="pending">Pendente</option>
                  <option value="paid">{type === 'payable' ? 'Pago' : 'Recebido'}</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            )}

            {err && <div className="md:col-span-2 text-sm text-red-600">{err}</div>}

            <div className="md:col-span-2 flex gap-2 justify-end pt-2 border-t">
              <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader className="w-4 h-4 animate-spin mr-2" />}
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        )}
    </>
  );

  if (embedded) return inner;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editing ? 'Editar conta' : type === 'payable' ? 'Nova conta a pagar' : 'Nova conta a receber'}</CardTitle>
      </CardHeader>
      <CardContent>{inner}</CardContent>
    </Card>
  );
}

/* ============================================================
   Categorias (gerenciar)
   ============================================================ */

export function CategoriasTab() {
  const { canWrite } = useUserRole();
  const [payable, setPayable] = useState<CategoryNode[]>([]);
  const [receivable, setReceivable] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        fetch('/api/bill-categories?type=payable').then((res) => res.json()),
        fetch('/api/bill-categories?type=receivable').then((res) => res.json()),
      ]);
      setPayable(p.categories || []);
      setReceivable(r.categories || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const flash = (type: 'success' | 'error', text: string) => {
    if (type === 'success') feedback.success(text);
    else feedback.error(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader className="w-5 h-5 animate-spin mr-2" />
        Carregando categorias...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryTree
          title="💸 Contas a pagar"
          type="payable"
          nodes={payable}
          canWrite={canWrite}
          onChange={reload}
          onFlash={flash}
        />
        <CategoryTree
          title="💰 Contas a receber"
          type="receivable"
          nodes={receivable}
          canWrite={canWrite}
          onChange={reload}
          onFlash={flash}
        />
      </div>
    </div>
  );
}

function CategoryTree({
  title,
  type,
  nodes,
  canWrite,
  onChange,
  onFlash,
}: {
  title: string;
  type: BillType;
  nodes: CategoryNode[];
  canWrite: boolean;
  onChange: () => void;
  onFlash: (t: 'success' | 'error', msg: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingRoot, setAddingRoot] = useState(false);
  const [rootDraft, setRootDraft] = useState('');
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const createCategory = async (name: string, parentId: string | null) => {
    const res = await fetch('/api/bill-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, parentId }),
    });
    if (res.ok) {
      onFlash('success', 'Categoria criada');
      if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
      onChange();
    } else {
      const d = await res.json().catch(() => ({}));
      onFlash('error', d.error || 'Erro ao criar');
    }
  };

  const renameCategory = async (id: string, name: string) => {
    const res = await fetch(`/api/bill-categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      onFlash('success', 'Renomeado');
      onChange();
    } else {
      const d = await res.json().catch(() => ({}));
      onFlash('error', d.error || 'Erro');
    }
  };

  const deleteCategory = async (id: string, label: string) => {
    if (!confirm(`Remover a categoria "${label}"?\n\nSe tiver contas vinculadas, a remoção é bloqueada.`)) return;
    const res = await fetch(`/api/bill-categories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      onFlash('success', 'Categoria removida');
      onChange();
    } else {
      const d = await res.json().catch(() => ({}));
      onFlash('error', d.error || 'Erro');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {canWrite && !addingRoot && (
            <Button size="sm" variant="outline" onClick={() => setAddingRoot(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Nova categoria
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {addingRoot && canWrite && (
          <div className="flex gap-2 mb-4">
            <input
              autoFocus
              value={rootDraft}
              onChange={(e) => setRootDraft(e.target.value)}
              placeholder="Nome da categoria"
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && rootDraft.trim()) {
                  createCategory(rootDraft.trim(), null);
                  setRootDraft('');
                  setAddingRoot(false);
                } else if (e.key === 'Escape') {
                  setAddingRoot(false);
                  setRootDraft('');
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                if (rootDraft.trim()) {
                  createCategory(rootDraft.trim(), null);
                  setRootDraft('');
                  setAddingRoot(false);
                }
              }}
              disabled={!rootDraft.trim()}
            >
              Criar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAddingRoot(false);
                setRootDraft('');
              }}
            >
              Cancelar
            </Button>
          </div>
        )}

        {nodes.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Sem categorias ainda.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {nodes.map((root) => {
              const isExp = expanded.has(root.id);
              const totalBills = root._count.bills + root.children.reduce((s, c) => s + c._count.bills, 0);
              return (
                <li key={root.id} className="py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggle(root.id)}
                      className="p-1 hover:bg-muted rounded"
                      disabled={root.children.length === 0}
                    >
                      {root.children.length > 0 ? (
                        isExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                      ) : (
                        <span className="w-4 h-4 inline-block" />
                      )}
                    </button>

                    {editingId === root.id ? (
                      <input
                        autoFocus
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onBlur={() => {
                          if (editDraft.trim() && editDraft !== root.name) renameCategory(root.id, editDraft.trim());
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editDraft.trim() && editDraft !== root.name) renameCategory(root.id, editDraft.trim());
                            setEditingId(null);
                          } else if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 border rounded px-2 py-1 text-sm"
                      />
                    ) : (
                      <span className="flex-1 font-medium text-foreground">{root.name}</span>
                    )}

                    <span className="text-xs text-muted-foreground">
                      {totalBills} conta{totalBills === 1 ? '' : 's'}
                    </span>

                    {canWrite && editingId !== root.id && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAddingSubFor(root.id);
                            setSubDraft('');
                            setExpanded((prev) => new Set(prev).add(root.id));
                          }}
                          title="Adicionar subcategoria"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(root.id);
                            setEditDraft(root.name);
                          }}
                          title="Renomear"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteCategory(root.id, root.name)} title="Remover">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </>
                    )}
                  </div>

                  {isExp && (
                    <ul className="ml-8 mt-2 space-y-1 border-l border-border pl-4">
                      {root.children.map((sub) => (
                        <li key={sub.id} className="flex items-center gap-2 py-1">
                          {editingId === sub.id ? (
                            <input
                              autoFocus
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onBlur={() => {
                                if (editDraft.trim() && editDraft !== sub.name) renameCategory(sub.id, editDraft.trim());
                                setEditingId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (editDraft.trim() && editDraft !== sub.name) renameCategory(sub.id, editDraft.trim());
                                  setEditingId(null);
                                } else if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="flex-1 border rounded px-2 py-1 text-sm"
                            />
                          ) : (
                            <span className="flex-1 text-sm text-foreground">{sub.name}</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {sub._count.bills} conta{sub._count.bills === 1 ? '' : 's'}
                          </span>
                          {canWrite && editingId !== sub.id && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingId(sub.id);
                                  setEditDraft(sub.name);
                                }}
                                title="Renomear"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteCategory(sub.id, sub.name)}
                                title="Remover"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </li>
                      ))}
                      {addingSubFor === root.id && canWrite && (
                        <li className="flex items-center gap-2 py-1">
                          <input
                            autoFocus
                            value={subDraft}
                            onChange={(e) => setSubDraft(e.target.value)}
                            placeholder="Nome da subcategoria"
                            className="flex-1 border rounded px-2 py-1 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && subDraft.trim()) {
                                createCategory(subDraft.trim(), root.id);
                                setSubDraft('');
                                setAddingSubFor(null);
                              } else if (e.key === 'Escape') {
                                setAddingSubFor(null);
                                setSubDraft('');
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              if (subDraft.trim()) {
                                createCategory(subDraft.trim(), root.id);
                                setSubDraft('');
                                setAddingSubFor(null);
                              }
                            }}
                            disabled={!subDraft.trim()}
                          >
                            OK
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAddingSubFor(null);
                              setSubDraft('');
                            }}
                          >
                            <XIcon className="w-4 h-4" />
                          </Button>
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
