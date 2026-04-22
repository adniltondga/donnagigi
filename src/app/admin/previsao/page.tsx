'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';

interface DiaRow {
  dia: number;
  vendas: number;
  totalVenda: number;
}

interface Relatorio {
  periodo: { year: number; month: number; daysToReceive: number };
  total: number;
  totalVendas: number;
  melhorDia: DiaRow;
  dias: DiaRow[];
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function PrevisaoPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Relatorio | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/relatorios/previsao?year=${year}&month=${month}`
      );
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

  const maxValor = data ? Math.max(1, ...data.dias.map((d) => d.totalVenda)) : 1;

  const mudarMes = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">💸 Previsão de Recebimentos</h1>
      <p className="text-gray-600 mb-6">
        Quanto vai cair na conta em cada dia do mês, considerando ~30 dias entre a venda e o
        repasse do Mercado Livre.
      </p>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-end">
        <button
          onClick={() => mudarMes(-1)}
          className="px-3 py-2 border rounded-lg hover:bg-gray-50"
        >
          ‹ Mês anterior
        </button>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border rounded px-3 py-2"
          >
            {MESES.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border rounded px-3 py-2 w-28"
          />
        </div>

        <button
          onClick={() => mudarMes(1)}
          className="px-3 py-2 border rounded-lg hover:bg-gray-50"
        >
          Próximo mês ›
        </button>

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow p-5 text-white">
              <p className="text-xs uppercase opacity-90">🛒 Total a receber em {MESES[month - 1]}</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(data.total)}</p>
              <p className="text-xs opacity-90 mt-1">{data.totalVendas} venda(s)</p>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-xs uppercase text-gray-500">📅 Dias com recebimento</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">
                {data.dias.filter((d) => d.totalVenda > 0).length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-xs uppercase text-gray-500">🏆 Melhor dia</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">
                {data.melhorDia.dia > 0 ? `Dia ${data.melhorDia.dia}` : '—'}
              </p>
              <p className="text-sm text-gray-600">
                {formatCurrency(data.melhorDia.totalVenda)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b font-semibold">
              Recebimentos por dia — {MESES[month - 1]} {year}
            </div>
            <div className="p-4 space-y-2">
              {data.dias.map((d) => {
                const isBest = data.melhorDia.dia === d.dia && d.totalVenda > 0;
                const pct = (d.totalVenda / maxValor) * 100;
                return (
                  <div key={d.dia} className="flex items-center gap-3">
                    <div className="w-10 text-right text-sm text-gray-600 font-mono">
                      {String(d.dia).padStart(2, '0')}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded h-6 relative overflow-hidden">
                      <div
                        className={`h-full ${isBest ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-blue-300'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-32 text-right text-sm font-semibold text-blue-700">
                      {d.totalVenda > 0 ? formatCurrency(d.totalVenda) : '—'}
                    </div>
                    <div className="w-20 text-right text-xs text-gray-500">
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
