'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';

interface DiaRow {
  dia: number;
  vendas: number;
  total: number;
  custo: number;
  liquido: number;
}

interface Relatorio {
  periodo: { from: string; to: string };
  totalVendas: number;
  totalGeral: number;
  totalCusto: number;
  totalLiquido: number;
  melhorDia: DiaRow;
  melhorDiaLucro: DiaRow;
  dias: DiaRow[];
}

function toInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function RelatoriosPage() {
  const today = new Date();
  const firstOfYear = new Date(today.getFullYear(), 0, 1);

  const [from, setFrom] = useState(toInput(firstOfYear));
  const [to, setTo] = useState(toInput(today));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Relatorio | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/relatorios/vendas-por-dia?from=${from}&to=${to}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxTotal = data ? Math.max(1, ...data.dias.map((d) => d.total)) : 1;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">📈 Relatório de Vendas</h1>
      <p className="text-gray-600 mb-6">Dia do mês (1 a 31) com maior faturamento no período.</p>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">De</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Até</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-lg font-semibold disabled:opacity-60"
        >
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs uppercase text-gray-500">💵 Bruto</p>
              <p className="text-xl font-bold text-gray-800">{formatCurrency(data.totalGeral)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs uppercase text-gray-500">💰 Custo</p>
              <p className="text-xl font-bold text-rose-600">{formatCurrency(data.totalCusto)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs uppercase text-gray-500">📈 Lucro</p>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(data.totalLiquido)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs uppercase text-gray-500">Qtd. vendas</p>
              <p className="text-xl font-bold text-gray-800">{data.totalVendas}</p>
            </div>
            <div className="bg-gradient-to-br from-primary-500 to-pink-600 rounded-lg shadow p-4 text-white">
              <p className="text-xs uppercase opacity-90">🏆 Melhor dia</p>
              <p className="text-xl font-bold">
                {data.melhorDia.dia > 0 ? `Dia ${data.melhorDia.dia}` : '—'}
              </p>
              <p className="text-xs opacity-90">
                {formatCurrency(data.melhorDia.total)} · {data.melhorDia.vendas} venda(s)
              </p>
              {data.melhorDiaLucro.dia > 0 && (
                <p className="text-xs opacity-90 mt-1 border-t border-white/30 pt-1">
                  Lucro: dia {data.melhorDiaLucro.dia} · {formatCurrency(data.melhorDiaLucro.liquido)}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b font-semibold">Faturamento por dia do mês</div>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-3 text-xs text-gray-500 font-semibold uppercase pb-1 border-b">
                <div className="w-10 text-right">Dia</div>
                <div className="flex-1" />
                <div className="w-28 text-right">Bruto</div>
                <div className="w-28 text-right">Custo</div>
                <div className="w-28 text-right">Lucro</div>
                <div className="w-16 text-right">Qtd</div>
              </div>
              {data.dias.map((d) => {
                const isBest = data.melhorDia.dia === d.dia && d.total > 0;
                const pct = (d.total / maxTotal) * 100;
                return (
                  <div key={d.dia} className="flex items-center gap-3">
                    <div className="w-10 text-right text-sm text-gray-600 font-mono">
                      {String(d.dia).padStart(2, '0')}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded h-6 relative overflow-hidden">
                      <div
                        className={`h-full ${isBest ? 'bg-gradient-to-r from-primary-500 to-pink-600' : 'bg-admin-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-28 text-right text-sm font-semibold">
                      {formatCurrency(d.total)}
                    </div>
                    <div className="w-28 text-right text-sm text-rose-600">
                      {d.custo > 0 ? formatCurrency(d.custo) : '—'}
                    </div>
                    <div className="w-28 text-right text-sm font-semibold text-emerald-600">
                      {d.liquido !== 0 ? formatCurrency(d.liquido) : '—'}
                    </div>
                    <div className="w-16 text-right text-xs text-gray-500">
                      {d.vendas > 0 ? `${d.vendas} vd` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
