'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
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
} from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { useUserRole } from '@/lib/useUserRole';
import CurrencyInput from '@/components/CurrencyInput';

export type BillType = 'payable' | 'receivable';

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
   Contas a pagar / Contas a receber
   ============================================================ */

export function BillsTab({ type }: { type: BillType }) {
  const { canWrite } = useUserRole();
  const [bills, setBills] = useState<Bill[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchBills = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type,
        excludeCategory: 'venda',
        page: String(page),
        limit: '20',
        orderBy: 'dueDate_asc',
      });
      if (statusFilter) params.set('status', statusFilter);
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
    const res = await fetch(`/api/bill-categories?type=${type}`);
    if (res.ok) {
      const d = await res.json();
      setCategories(d.categories || []);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [type]);
  useEffect(() => {
    fetchBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, type]);

  const onMarkPaid = async (id: string) => {
    const res = await fetch(`/api/bills/${id}/pay`, { method: 'PATCH' });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Conta paga!' });
      fetchBills();
    }
  };

  const onDelete = async (id: string) => {
    const res = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Conta deletada' });
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

    for (const b of bills) {
      if (b.status !== 'pending') continue;
      const due = new Date(b.dueDate);
      due.setHours(0, 0, 0, 0);
      pendentesCount++;
      pendentesAmount += b.amount;
      if (due < now) {
        vencidasCount++;
        vencidasAmount += b.amount;
      } else if (due <= in7) {
        proximasCount++;
        proximasAmount += b.amount;
      }
    }
    return { proximasCount, proximasAmount, vencidasCount, vencidasAmount, pendentesCount, pendentesAmount };
  }, [bills]);

  const emptyLabel = type === 'payable' ? 'Nenhuma conta a pagar' : 'Nenhuma conta a receber';
  const newLabel = type === 'payable' ? 'Nova conta a pagar' : 'Nova conta a receber';

  return (
    <div className="space-y-6">
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={() => setShowNewForm(!showNewForm)}>
            <Plus className="w-4 h-4 mr-1" />
            {newLabel}
          </Button>
        </div>
      )}

      {message && (
        <div
          className={`p-3 rounded text-sm ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label={type === 'payable' ? 'A pagar · 7 dias' : 'A receber · 7 dias'}
          value={formatCurrency(summary.proximasAmount)}
          sub={`${summary.proximasCount} conta(s)`}
          icon={CalendarClock}
          accent="amber"
        />
        <StatCard
          label="Vencidas"
          value={formatCurrency(summary.vencidasAmount)}
          sub={`${summary.vencidasCount} conta(s)`}
          icon={AlertTriangle}
          accent="rose"
        />
        <StatCard
          label={type === 'payable' ? 'Total pendente' : 'Total a receber'}
          value={formatCurrency(summary.pendentesAmount)}
          sub={`${summary.pendentesCount} conta(s)`}
          icon={Wallet}
          accent="emerald"
        />
      </div>

      {showNewForm && canWrite && (
        <BillForm
          type={type}
          categories={categories}
          onCancel={() => setShowNewForm(false)}
          onSaved={() => {
            setShowNewForm(false);
            setPage(1);
            fetchBills();
            setMessage({ type: 'success', text: 'Conta criada' });
          }}
        />
      )}

      {editBill && canWrite && (
        <BillForm
          type={type}
          bill={editBill}
          categories={categories}
          onCancel={() => setEditBill(null)}
          onSaved={() => {
            setEditBill(null);
            fetchBills();
            setMessage({ type: 'success', text: 'Conta atualizada' });
          }}
        />
      )}

      <div className="flex gap-2 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="paid">Pagos</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            Carregando...
          </div>
        ) : bills.length === 0 ? (
          <EmptyState icon={FileText} title={emptyLabel} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
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
                    <TableCell className="text-sm whitespace-nowrap">{formatDate(b.dueDate)}</TableCell>
                    <TableCell className="text-sm">{b.description}</TableCell>
                    <TableCell className="text-sm text-gray-600">
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
                      <div className="flex gap-1 justify-end">
                        {canWrite && (
                          <Button onClick={() => setEditBill(b)} size="sm" variant="ghost" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canWrite && b.status !== 'paid' && b.status !== 'cancelled' && (
                          <Button
                            onClick={() => onMarkPaid(b.id)}
                            size="sm"
                            variant="ghost"
                            title={type === 'payable' ? 'Marcar como paga' : 'Marcar como recebida'}
                          >
                            <Check className="w-4 h-4 text-emerald-600" />
                          </Button>
                        )}
                        {canWrite && deleteConfirm === b.id ? (
                          <>
                            <Button onClick={() => onDelete(b.id)} size="sm" variant="ghost" title="Confirmar">
                              <Check className="w-4 h-4 text-red-600" />
                            </Button>
                            <Button onClick={() => setDeleteConfirm(null)} size="sm" variant="ghost" title="Cancelar">
                              <XIcon className="w-4 h-4" />
                            </Button>
                          </>
                        ) : canWrite ? (
                          <Button
                            onClick={() => setDeleteConfirm(b.id)}
                            size="sm"
                            variant="ghost"
                            title="Deletar"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        ) : null}
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
          <span className="px-4 py-2 text-gray-700">
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
}: {
  type: BillType;
  bill?: Bill;
  categories: CategoryNode[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const editing = !!bill;
  const [rootId, setRootId] = useState<string>(() => {
    if (bill?.billCategory?.parent) return bill.billCategory.parent.id;
    if (bill?.billCategory && !bill.billCategory.parent) return bill.billCategory.id;
    return categories[0]?.id || '';
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

  const rootCat = categories.find((c) => c.id === rootId);
  const subs = rootCat?.children || [];

  useEffect(() => {
    if (!bill) setSubId('');
  }, [rootId, bill]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editing ? 'Editar conta' : type === 'payable' ? 'Nova conta a pagar' : 'Nova conta a receber'}</CardTitle>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <div className="text-sm text-gray-500">
            Nenhuma categoria cadastrada. Vá em <strong>Financeiro &gt; Categorias</strong> e crie uma primeiro.
          </div>
        ) : (
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select
                value={rootId}
                onChange={(e) => setRootId(e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Selecione...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subcategoria <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <select
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
                disabled={subs.length === 0}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">{subs.length === 0 ? 'Sem subcategorias' : 'Selecione...'}</option>
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <CurrencyInput
                value={amount === '' ? 0 : parseFloat(amount)}
                onChange={(v) => setAmount(v > 0 ? String(v) : '')}
                placeholder="R$ 0,00"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
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
      </CardContent>
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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader className="w-5 h-5 animate-spin mr-2" />
        Carregando categorias...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-3 rounded text-sm ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

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
          <div className="text-sm text-gray-500 py-4 text-center">Sem categorias ainda.</div>
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
                      className="p-1 hover:bg-gray-100 rounded"
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
                      <span className="flex-1 font-medium text-gray-900">{root.name}</span>
                    )}

                    <span className="text-xs text-gray-400">
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
                    <ul className="ml-8 mt-2 space-y-1 border-l border-gray-200 pl-4">
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
                            <span className="flex-1 text-sm text-gray-800">{sub.name}</span>
                          )}
                          <span className="text-xs text-gray-400">
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
