'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Package } from 'lucide-react';

interface Item {
  mlListingId: string;
  title: string;
  vendas: number;
  totalBruto: number;
  ultimaVenda: string | null;
  productCost: number | null;
  updatedAt: string | null;
}

type Filtro = 'todos' | 'sem' | 'com';

export default function CustosMLPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ml/custos');
      const json = await res.json();
      setItems(json.items || []);
      const initial: Record<string, string> = {};
      for (const it of json.items || []) {
        initial[it.mlListingId] = it.productCost != null ? String(it.productCost) : '';
      }
      setDrafts(initial);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (item: Item) => {
    const raw = drafts[item.mlListingId];
    const val = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(val) || val < 0) {
      setToast('Custo inválido');
      setTimeout(() => setToast(null), 2500);
      return;
    }
    setSaving(item.mlListingId);
    try {
      const res = await fetch('/api/ml/custos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mlListingId: item.mlListingId,
          productCost: val,
          title: item.title,
          aplicarRetroativo: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro || 'erro');
      setToast(
        `✅ Salvo. ${json.atualizados > 0 ? `${json.atualizados} venda(s) retroativa(s) atualizada(s).` : ''}`
      );
      setTimeout(() => setToast(null), 3000);
      await load();
    } catch (err) {
      setToast('Erro ao salvar');
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(null);
    }
  };

  const counts = useMemo(() => {
    const sem = items.filter((i) => i.productCost == null).length;
    const com = items.length - sem;
    return { total: items.length, sem, com };
  }, [items]);

  const visibleItems = useMemo(() => {
    const filtered = items.filter((i) => {
      if (filtro === 'sem') return i.productCost == null;
      if (filtro === 'com') return i.productCost != null;
      return true;
    });
    // pendentes primeiro, depois por número de vendas desc
    return filtered.sort((a, b) => {
      const aSem = a.productCost == null ? 1 : 0;
      const bSem = b.productCost == null ? 1 : 0;
      if (aSem !== bSem) return bSem - aSem;
      return b.vendas - a.vendas;
    });
  }, [items, filtro]);

  const filtroBtn = (value: Filtro, label: string, count: number) => (
    <button
      onClick={() => setFiltro(value)}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
        filtro === value
          ? 'bg-primary-500 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label} <span className="opacity-80">({count})</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="💰 Custos ML"
        description="Cadastre o custo da mercadoria por anúncio. Toda venda futura desse anúncio já entra no financeiro com o custo abatido, e as vendas anteriores sem custo são atualizadas automaticamente."
      />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded shadow-lg">
          {toast}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {filtroBtn('todos', 'Todos', counts.total)}
            {filtroBtn('sem', '⚠ Sem custo', counts.sem)}
            {filtroBtn('com', '✅ Com custo', counts.com)}
          </div>
          <button
            onClick={load}
            className="text-sm text-primary-600 hover:text-primary-700 font-semibold"
          >
            🔄 Atualizar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Anúncio ML</th>
                <th className="text-left px-4 py-3">Título</th>
                <th className="text-right px-4 py-3">Vendas</th>
                <th className="text-right px-4 py-3">Bruto</th>
                <th className="text-right px-4 py-3">Custo (R$)</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((it) => {
                const semCusto = it.productCost == null;
                return (
                  <tr key={it.mlListingId} className={`border-t ${semCusto ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://produto.mercadolivre.com.br/${it.mlListingId.replace('MLB', 'MLB-')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline"
                        >
                          {it.mlListingId}
                        </a>
                        {semCusto && (
                          <span className="inline-block bg-amber-200 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            PENDENTE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-md truncate" title={it.title}>
                      {it.title || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">{it.vendas}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(it.totalBruto)}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={drafts[it.mlListingId] ?? ''}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [it.mlListingId]: e.target.value }))
                        }
                        className="w-28 border rounded px-2 py-1 text-right"
                        placeholder="0,00"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => save(it)}
                        disabled={saving === it.mlListingId}
                        className="bg-primary-600 hover:bg-primary-700 text-white text-xs px-3 py-1.5 rounded font-semibold disabled:opacity-60"
                      >
                        {saving === it.mlListingId ? 'Salvando...' : 'Salvar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && visibleItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-0 py-0">
                    <EmptyState
                      icon={Package}
                      title={items.length === 0 ? 'Nenhum anúncio com venda encontrado' : 'Nenhum item nesse filtro'}
                      description={items.length === 0 ? 'Sincronize pedidos do ML primeiro.' : undefined}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
