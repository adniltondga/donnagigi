'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Package, ChevronDown, ChevronRight } from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import CurrencyInput from '@/components/CurrencyInput';

interface Variation {
  variationId: string;
  variationName: string | null;
  productCost: number | null;
  vendas: number;
  totalBruto: number;
  ultimaVenda: string | null;
}

interface Item {
  mlListingId: string;
  title: string;
  vendas: number;
  totalBruto: number;
  ultimaVenda: string | null;
  productCost: number | null;
  updatedAt: string | null;
  variations: Variation[];
}

type Filtro = 'todos' | 'sem' | 'com';

// Chave pra drafts de variação
const vkey = (listingId: string, variationId: string) => `${listingId}|${variationId}`;

export default function CustosMLPage() {
  const { canWrite } = useUserRole();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [variantDrafts, setVariantDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ml/custos');
      const json = await res.json();
      const list: Item[] = json.items || [];
      setItems(list);
      const initialListing: Record<string, string> = {};
      const initialVariant: Record<string, string> = {};
      for (const it of list) {
        initialListing[it.mlListingId] = it.productCost != null ? String(it.productCost) : '';
        for (const v of it.variations || []) {
          initialVariant[vkey(it.mlListingId, v.variationId)] =
            v.productCost != null ? String(v.productCost) : '';
        }
      }
      setDrafts(initialListing);
      setVariantDrafts(initialVariant);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveListing = async (item: Item) => {
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
        `✅ Custo geral salvo. ${json.atualizados > 0 ? `${json.atualizados} venda(s) retroativa(s).` : ''}`
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

  const saveVariation = async (item: Item, v: Variation) => {
    const k = vkey(item.mlListingId, v.variationId);
    const raw = variantDrafts[k];
    const val = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(val) || val < 0) {
      setToast('Custo inválido');
      setTimeout(() => setToast(null), 2500);
      return;
    }
    setSaving(k);
    try {
      const res = await fetch('/api/ml/custos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mlListingId: item.mlListingId,
          variationId: v.variationId,
          variationName: v.variationName,
          productCost: val,
          aplicarRetroativo: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro || 'erro');
      setToast(
        `✅ Variação salva. ${json.atualizados > 0 ? `${json.atualizados} venda(s) retroativa(s).` : ''}`
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
        description="Cadastre o custo da mercadoria por anúncio. Anúncios com variações permitem definir um custo específico por variação — se não definir, usa o custo geral como fallback."
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
                <th className="text-left px-2 py-3 w-8" />
                <th className="text-left px-4 py-3">Anúncio ML</th>
                <th className="text-left px-4 py-3">Título</th>
                <th className="text-right px-4 py-3">Vendas</th>
                <th className="text-right px-4 py-3">Bruto</th>
                <th className="text-right px-4 py-3">Custo geral (R$)</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((it) => {
                const semCusto = it.productCost == null;
                const hasVariations = (it.variations?.length ?? 0) > 0;
                const isOpen = expanded.has(it.mlListingId);
                return (
                  <Fragment key={it.mlListingId}>
                    <tr
                      className={`border-t ${semCusto ? 'bg-amber-50/50' : ''}`}
                    >
                      <td className="px-2 py-3 text-center">
                        {hasVariations && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(it.mlListingId)}
                            className="p-1 hover:bg-gray-100 rounded"
                            aria-label={isOpen ? 'Recolher variações' : 'Expandir variações'}
                          >
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                        )}
                      </td>
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
                          {hasVariations && (
                            <span className="inline-block bg-primary-100 text-primary-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                              {it.variations.length} var.
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
                        {canWrite ? (
                          <CurrencyInput
                            value={drafts[it.mlListingId] ?? ''}
                            onChange={(v) =>
                              setDrafts((d) => ({
                                ...d,
                                [it.mlListingId]: v > 0 ? String(v) : '',
                              }))
                            }
                            placeholder="0,00"
                            className="w-28 border rounded px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-primary-600"
                          />
                        ) : (
                          <span className="text-gray-700">
                            {it.productCost != null ? formatCurrency(it.productCost) : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canWrite && (
                          <button
                            onClick={() => saveListing(it)}
                            disabled={saving === it.mlListingId}
                            className="bg-primary-600 hover:bg-primary-700 text-white text-xs px-3 py-1.5 rounded font-semibold disabled:opacity-60"
                          >
                            {saving === it.mlListingId ? 'Salvando...' : 'Salvar'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {isOpen && hasVariations && (
                      <tr>
                        <td colSpan={7} className="bg-gray-50/50 px-0 py-0">
                          <div className="px-6 py-3">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Variações ({it.variations.length})
                            </div>
                            <table className="w-full text-sm">
                              <thead className="text-gray-500 text-xs">
                                <tr>
                                  <th className="text-left px-3 py-2">Variação</th>
                                  <th className="text-left px-3 py-2 font-mono">ID</th>
                                  <th className="text-right px-3 py-2">Vendas</th>
                                  <th className="text-right px-3 py-2">Bruto</th>
                                  <th className="text-right px-3 py-2">Custo (R$)</th>
                                  <th className="px-3 py-2" />
                                </tr>
                              </thead>
                              <tbody>
                                {it.variations.map((v) => {
                                  const k = vkey(it.mlListingId, v.variationId);
                                  const semV = v.productCost == null;
                                  return (
                                    <tr
                                      key={v.variationId}
                                      className={`border-t border-gray-200 ${semV ? 'bg-amber-50/30' : ''}`}
                                    >
                                      <td className="px-3 py-2">
                                        <span className="inline-block bg-primary-50 text-primary-700 border border-primary-100 rounded px-2 py-0.5 text-xs">
                                          {v.variationName || '—'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 font-mono text-[10px] text-gray-500">
                                        {v.variationId}
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-700">
                                        {v.vendas}
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-700">
                                        {formatCurrency(v.totalBruto)}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {canWrite ? (
                                          <CurrencyInput
                                            value={variantDrafts[k] ?? ''}
                                            onChange={(val) =>
                                              setVariantDrafts((d) => ({
                                                ...d,
                                                [k]: val > 0 ? String(val) : '',
                                              }))
                                            }
                                            placeholder={
                                              it.productCost != null
                                                ? String(it.productCost).replace('.', ',')
                                                : '0,00'
                                            }
                                            className="w-24 border rounded px-2 py-1 text-right text-xs focus:outline-none focus:ring-2 focus:ring-primary-600"
                                          />
                                        ) : (
                                          <span>
                                            {v.productCost != null
                                              ? formatCurrency(v.productCost)
                                              : '—'}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {canWrite && (
                                          <button
                                            onClick={() => saveVariation(it, v)}
                                            disabled={saving === k}
                                            className="bg-primary-600 hover:bg-primary-700 text-white text-[11px] px-2 py-1 rounded font-semibold disabled:opacity-60"
                                          >
                                            {saving === k ? '...' : 'Salvar'}
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!loading && visibleItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-0 py-0">
                    <EmptyState
                      icon={Package}
                      title={
                        items.length === 0
                          ? 'Nenhum anúncio com venda encontrado'
                          : 'Nenhum item nesse filtro'
                      }
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
