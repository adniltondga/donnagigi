'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';

interface Item {
  mlListingId: string;
  title: string;
  vendas: number;
  totalBruto: number;
  ultimaVenda: string | null;
  productCost: number | null;
  updatedAt: string | null;
}

export default function CustosMLPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Form manual
  const [novoId, setNovoId] = useState('');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoCusto, setNovoCusto] = useState('');
  const [addingNovo, setAddingNovo] = useState(false);

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

  const adicionarManual = async () => {
    const id = novoId.trim().toUpperCase();
    const val = Number(String(novoCusto).replace(',', '.'));
    if (!id.startsWith('MLB')) {
      setToast('ID inválido. Ex.: MLB1234567890');
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (!Number.isFinite(val) || val < 0) {
      setToast('Custo inválido');
      setTimeout(() => setToast(null), 2500);
      return;
    }
    setAddingNovo(true);
    try {
      const res = await fetch('/api/ml/custos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mlListingId: id,
          productCost: val,
          title: novoTitulo.trim() || null,
          aplicarRetroativo: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro || 'erro');
      setToast(
        `✅ Custo cadastrado. ${json.atualizados > 0 ? `${json.atualizados} venda(s) retroativa(s).` : ''}`
      );
      setTimeout(() => setToast(null), 3000);
      setNovoId('');
      setNovoTitulo('');
      setNovoCusto('');
      await load();
    } catch (err) {
      setToast('Erro ao adicionar');
      setTimeout(() => setToast(null), 2500);
    } finally {
      setAddingNovo(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">💰 Custos ML</h1>
      <p className="text-gray-600 mb-6">
        Cadastre o custo da mercadoria por anúncio. Toda venda futura desse anúncio já entra no
        financeiro com o custo abatido, e as vendas anteriores sem custo são atualizadas automaticamente.
      </p>

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <p className="font-semibold mb-3">➕ Adicionar anúncio manualmente</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-600 mb-1">ID do anúncio (MLB...)</label>
            <input
              type="text"
              value={novoId}
              onChange={(e) => setNovoId(e.target.value)}
              placeholder="MLB1234567890"
              className="w-full border rounded px-3 py-2 font-mono text-sm"
            />
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-gray-600 mb-1">Título (opcional)</label>
            <input
              type="text"
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              placeholder="Ex.: Capa iPhone 15"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Custo (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={novoCusto}
              onChange={(e) => setNovoCusto(e.target.value)}
              placeholder="0,00"
              className="w-32 border rounded px-3 py-2 text-right text-sm"
            />
          </div>
          <button
            onClick={adicionarManual}
            disabled={addingNovo}
            className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-lg font-semibold disabled:opacity-60"
          >
            {addingNovo ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Dica: o ID do anúncio está na URL do Mercado Livre (ex.: <code>MLB1234567890</code>) ou no painel de vendedor.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <span className="font-semibold">
            {loading ? 'Carregando...' : `${items.length} anúncio(s) com vendas`}
          </span>
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
              {items.map((it) => (
                <tr key={it.mlListingId} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">
                    <a
                      href={`https://produto.mercadolivre.com.br/${it.mlListingId.replace('MLB', 'MLB-')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline"
                    >
                      {it.mlListingId}
                    </a>
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
                      className="bg-primary-500 hover:bg-primary-600 text-white text-xs px-3 py-1.5 rounded font-semibold disabled:opacity-60"
                    >
                      {saving === it.mlListingId ? 'Salvando...' : 'Salvar'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nenhum anúncio com venda encontrado. Sincronize pedidos do ML primeiro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
