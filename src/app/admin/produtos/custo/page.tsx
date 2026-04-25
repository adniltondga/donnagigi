'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Package, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import CurrencyInput from '@/components/CurrencyInput';

type ChildVariation = {
  kind: 'child';
  mlListingId: string;
  variationName: string | null;
  price: number;
  status: string;
  productCost: number | null;
};

type MLVariation = {
  kind: 'ml';
  variationId: string;
  variationName: string | null;
  price: number;
  productCost: number | null;
};

type Variation = ChildVariation | MLVariation;

interface Item {
  mlListingId: string | null;      // null para grupos de catálogo
  catalogProductId: string | null;
  title: string;
  price: number;
  status: string;
  productCost: number | null;
  variations: Variation[];
}

type Filtro = 'todos' | 'sem' | 'com';

function varDraftKey(parentId: string | null, v: Variation): string {
  return v.kind === 'child'
    ? `child|${v.mlListingId}`
    : `ml|${parentId ?? ''}|${v.variationId}`;
}

function calcLucro(price: number, productCost: number | null): number | null {
  if (productCost == null) return null;
  return price - productCost;
}

function LucroCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={value >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
      {formatCurrency(value)}
    </span>
  );
}

export default function ProdutosCustoPage() {
  const { canWrite } = useUserRole();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [variantDrafts, setVariantDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ml/anuncios');
      const json = await res.json();
      if (!res.ok) {
        setError(json?.erro || 'Erro ao carregar anúncios');
        return;
      }
      const list: Item[] = json.items || [];
      setItems(list);

      const initialListing: Record<string, string> = {};
      const initialVariant: Record<string, string> = {};
      for (const it of list) {
        if (it.mlListingId) initialListing[it.mlListingId] = it.productCost != null ? String(it.productCost) : '';
        for (const v of it.variations ?? []) {
          const k = varDraftKey(it.mlListingId, v);
          const cost = v.productCost;
          initialVariant[k] = cost != null ? String(cost) : '';
        }
      }
      setDrafts(initialListing);
      setVariantDrafts(initialVariant);
    } catch (err) {
      setError('Erro ao conectar com o servidor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const saveListing = async (item: Item) => {
    if (!item.mlListingId) return;
    const val = Number(String(drafts[item.mlListingId] ?? '').replace(',', '.'));
    if (!Number.isFinite(val) || val < 0) { showToast('Custo inválido'); return; }
    setSaving(item.mlListingId);
    try {
      const res = await fetch('/api/ml/custos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mlListingId: item.mlListingId, productCost: val, title: item.title, aplicarRetroativo: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro);
      showToast(`Custo salvo.${json.atualizados > 0 ? ` ${json.atualizados} venda(s) atualizada(s).` : ''}`);
      await load();
    } catch { showToast('Erro ao salvar'); }
    finally { setSaving(null); }
  };

  const saveVariation = async (item: Item, v: Variation) => {
    const k = varDraftKey(item.mlListingId, v);
    const val = Number(String(variantDrafts[k] ?? '').replace(',', '.'));
    if (!Number.isFinite(val) || val < 0) { showToast('Custo inválido'); return; }
    setSaving(k);
    try {
      let body: Record<string, unknown>;
      if (v.kind === 'child') {
        // Filho é um listing independente — salva como listing próprio
        body = { mlListingId: v.mlListingId, productCost: val, title: v.variationName, aplicarRetroativo: true };
      } else {
        // Variação nativa do ML — salva em MLProductVariantCost
        body = { mlListingId: item.mlListingId, variationId: v.variationId, variationName: v.variationName, productCost: val, aplicarRetroativo: true };
      }
      const res = await fetch('/api/ml/custos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro);
      showToast(`Custo salvo.${json.atualizados > 0 ? ` ${json.atualizados} venda(s) atualizada(s).` : ''}`);
      await load();
    } catch { showToast('Erro ao salvar'); }
    finally { setSaving(null); }
  };

  const counts = useMemo(() => {
    const sem = items.filter((i) => i.productCost == null).length;
    return { total: items.length, sem, com: items.length - sem };
  }, [items]);

  const visibleItems = useMemo(() =>
    items.filter((i) => {
      if (filtro === 'sem') return i.productCost == null;
      if (filtro === 'com') return i.productCost != null;
      return true;
    }),
  [items, filtro]);

  const filtroBtn = (value: Filtro, label: string, count: number) => (
    <button
      onClick={() => setFiltro(value)}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
        filtro === value ? 'bg-primary-500 text-white' : 'bg-muted text-foreground hover:bg-accent'
      }`}
    >
      {label} <span className="opacity-80">({count})</span>
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Custo de Produtos"
        description="Cadastre o custo por anúncio. Anúncios agrupados no ML aparecem como variações expansíveis."
      />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded shadow-lg text-sm">
          {toast}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 mb-4">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {filtroBtn('todos', 'Todos', counts.total)}
            {filtroBtn('sem', 'Sem custo', counts.sem)}
            {filtroBtn('com', 'Com custo', counts.com)}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="text-sm text-primary-600 hover:text-primary-700 font-semibold disabled:opacity-50"
          >
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left px-2 py-3 w-8" />
                <th className="text-left px-4 py-3">Anúncio</th>
                <th className="text-left px-4 py-3">Título</th>
                <th className="text-right px-4 py-3">Valor Bruto</th>
                <th className="text-right px-4 py-3">Custo (R$)</th>
                <th className="text-right px-4 py-3">Lucro</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Buscando anúncios no Mercado Livre...
                  </td>
                </tr>
              )}

              {visibleItems.map((it) => {
                const rowKey = it.mlListingId ?? `cat|${it.catalogProductId}`;
                const isGroup = it.mlListingId == null;
                const semCusto = !isGroup && it.productCost == null;
                const hasVariations = (it.variations?.length ?? 0) > 0;
                const isOpen = expanded.has(rowKey);
                const lucro = calcLucro(it.price, it.productCost);

                return (
                  <Fragment key={rowKey}>
                    <tr className={`border-t ${semCusto ? 'bg-amber-50/50' : isGroup ? 'bg-muted' : ''}`}>
                      <td className="px-2 py-3 text-center">
                        {hasVariations && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(rowKey)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {isOpen
                              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          {it.mlListingId ? (
                            <a
                              href={`https://produto.mercadolivre.com.br/${it.mlListingId.replace('MLB', 'MLB-')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:underline"
                            >
                              {it.mlListingId}
                            </a>
                          ) : (
                            <span className="text-muted-foreground italic text-[10px]">catálogo</span>
                          )}
                          {semCusto && (
                            <span className="bg-amber-200 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              PENDENTE
                            </span>
                          )}
                          {hasVariations && (
                            <span className="bg-primary-100 text-primary-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                              {it.variations.length} var.
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">{it.title || '—'}</td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {isGroup ? '—' : formatCurrency(it.price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isGroup && canWrite ? (
                          <CurrencyInput
                            value={drafts[it.mlListingId!] ?? ''}
                            onChange={(v) => setDrafts((d) => ({ ...d, [it.mlListingId!]: v > 0 ? String(v) : '' }))}
                            placeholder="0,00"
                            className="w-28 border rounded px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-primary-600"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isGroup ? <span className="text-muted-foreground">—</span> : <LucroCell value={lucro} />}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isGroup && canWrite && (
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
                        <td colSpan={7} className="bg-muted/50 px-0 py-0">
                          <div className="px-6 py-3">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              Variações ({it.variations.length})
                            </div>
                            <table className="w-full text-sm">
                              <thead className="text-muted-foreground text-xs">
                                <tr>
                                  <th className="text-left px-3 py-2">Variação</th>
                                  <th className="text-right px-3 py-2">Valor Bruto</th>
                                  <th className="text-right px-3 py-2">Custo (R$)</th>
                                  <th className="text-right px-3 py-2">Lucro</th>
                                  <th className="px-3 py-2 w-20" />
                                </tr>
                              </thead>
                              <tbody>
                                {it.variations.map((v) => {
                                  const k = varDraftKey(it.mlListingId, v);
                                  const semV = v.productCost == null;
                                  const lucroV = calcLucro(v.price, v.productCost);
                                  const label = v.kind === 'child'
                                    ? v.variationName ?? v.mlListingId
                                    : v.variationName ?? v.variationId;
                                  return (
                                    <tr
                                      key={k}
                                      className={`border-t border-border ${semV ? 'bg-amber-50/30' : ''}`}
                                    >
                                      <td className="px-3 py-2">
                                        <span className="inline-block bg-primary-50 text-primary-700 border border-primary-100 rounded px-2 py-0.5 text-xs">
                                          {label}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-right text-foreground">{formatCurrency(v.price)}</td>
                                      <td className="px-3 py-2 text-right">
                                        {canWrite ? (
                                          <CurrencyInput
                                            value={variantDrafts[k] ?? ''}
                                            onChange={(val) =>
                                              setVariantDrafts((d) => ({ ...d, [k]: val > 0 ? String(val) : '' }))
                                            }
                                            placeholder={it.productCost != null ? String(it.productCost).replace('.', ',') : '0,00'}
                                            className="w-24 border rounded px-2 py-1 text-right text-xs focus:outline-none focus:ring-2 focus:ring-primary-600"
                                          />
                                        ) : (
                                          <span>{v.productCost != null ? formatCurrency(v.productCost) : '—'}</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-right"><LucroCell value={lucroV} /></td>
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

              {!loading && !error && visibleItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-0 py-0">
                    <EmptyState
                      icon={Package}
                      title={items.length === 0 ? 'Nenhum anúncio encontrado' : 'Nenhum item nesse filtro'}
                      description={items.length === 0 ? 'Verifique se a integração com o Mercado Livre está configurada.' : undefined}
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
