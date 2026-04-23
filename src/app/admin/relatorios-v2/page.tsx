'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TimelinePoint {
  date: string;
  vendas: number;
  bruto: number;
  totalVenda: number;
  lucro: number;
}

interface ProdutoAgg {
  productId: string | null;
  mlListingId: string | null;
  name: string;
  vendas: number;
  bruto: number;
  totalVenda: number;
  custo: number;
  lucro: number;
  margem: number;
}

interface KPIs {
  vendas: number;
  bruto: number;
  taxaVenda: number;
  envio: number;
  totalVenda: number;
  custo: number;
  lucro: number;
}

interface Relatorio {
  periodo: { from: string; to: string };
  periodoAnterior: { from: string; to: string };
  kpisAtual: KPIs;
  kpisAnterior: KPIs;
  derivados: {
    ticketMedio: number;
    ticketMedioAnterior: number;
    margemPct: number;
    margemPctAnterior: number;
  };
  cancelamentos: {
    vendas: number;
    bruto: number;
    totalVenda: number;
    taxaPct: number;
  };
  timeline: TimelinePoint[];
  topPorLucro: ProdutoAgg[];
  topPorBruto: ProdutoAgg[];
}

function toInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function delta(curr: number, prev: number): { pct: number; up: boolean; neutral: boolean } {
  if (prev === 0) {
    if (curr === 0) return { pct: 0, up: false, neutral: true };
    return { pct: 100, up: curr > 0, neutral: false };
  }
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  return { pct, up: pct >= 0, neutral: Math.abs(pct) < 0.01 };
}

function DeltaBadge({ curr, prev, inverso = false }: { curr: number; prev: number; inverso?: boolean }) {
  const d = delta(curr, prev);
  if (d.neutral) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const positivo = inverso ? !d.up : d.up;
  const cor = positivo ? 'text-emerald-600' : 'text-red-600';
  const arrow = d.up ? '▲' : '▼';
  return (
    <span className={`text-xs font-semibold ${cor}`}>
      {arrow} {Math.abs(d.pct).toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  prev,
  format = 'currency',
  inverso = false,
  accent,
}: {
  label: string;
  value: number;
  prev: number;
  format?: 'currency' | 'number' | 'percent';
  inverso?: boolean;
  accent?: string;
}) {
  const formatted =
    format === 'currency'
      ? formatCurrency(value)
      : format === 'percent'
      ? `${value.toFixed(1)}%`
      : value.toLocaleString('pt-BR');
  const prevFormatted =
    format === 'currency'
      ? formatCurrency(prev)
      : format === 'percent'
      ? `${prev.toFixed(1)}%`
      : prev.toLocaleString('pt-BR');

  return (
    <Card className="p-4">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${accent || 'text-gray-800'}`}>{formatted}</p>
      <div className="flex items-center gap-2 mt-1">
        <DeltaBadge curr={value} prev={prev} inverso={inverso} />
        <span className="text-xs text-gray-400">ant: {prevFormatted}</span>
      </div>
    </Card>
  );
}

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function RelatoriosV2Page() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [from, setFrom] = useState(toInput(firstOfMonth));
  const [to, setTo] = useState(toInput(today));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Relatorio | null>(null);
  const [tab, setTab] = useState<'lucro' | 'bruto'>('lucro');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/relatorios/v2?from=${from}&to=${to}`);
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

  const setPreset = (preset: 'mes' | 'mes_anterior' | 'ano' | '30d' | '7d') => {
    const now = new Date();
    let f: Date;
    let t: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (preset) {
      case 'mes':
        f = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'mes_anterior':
        f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        t = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'ano':
        f = new Date(now.getFullYear(), 0, 1);
        break;
      case '30d':
        f = new Date(now);
        f.setDate(f.getDate() - 29);
        break;
      case '7d':
        f = new Date(now);
        f.setDate(f.getDate() - 6);
        break;
    }
    setFrom(toInput(f));
    setTo(toInput(t));
  };

  const topList = data ? (tab === 'lucro' ? data.topPorLucro : data.topPorBruto) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="📊 Relatório V2"
        description="KPIs com comparativo vs período anterior, tendência diária real, top produtos e devoluções."
        badge={
          <span className="bg-primary-100 text-primary-700 text-xs font-semibold px-2 py-1 rounded">BETA</span>
        }
      />

      {/* Filtros */}
      <Card className="p-4 flex flex-wrap gap-4 items-end">
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

        <div className="flex flex-wrap gap-2 ml-auto">
          <button onClick={() => setPreset('7d')} className="text-xs px-3 py-1.5 rounded border hover:bg-gray-50">
            7 dias
          </button>
          <button onClick={() => setPreset('30d')} className="text-xs px-3 py-1.5 rounded border hover:bg-gray-50">
            30 dias
          </button>
          <button onClick={() => setPreset('mes')} className="text-xs px-3 py-1.5 rounded border hover:bg-gray-50">
            Este mês
          </button>
          <button onClick={() => setPreset('mes_anterior')} className="text-xs px-3 py-1.5 rounded border hover:bg-gray-50">
            Mês anterior
          </button>
          <button onClick={() => setPreset('ano')} className="text-xs px-3 py-1.5 rounded border hover:bg-gray-50">
            Ano
          </button>
        </div>
      </Card>

      {data && (
        <>
          {/* KPIs com comparativo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="💵 Bruto" value={data.kpisAtual.bruto} prev={data.kpisAnterior.bruto} />
            <KpiCard
              label="🛒 Total Venda"
              value={data.kpisAtual.totalVenda}
              prev={data.kpisAnterior.totalVenda}
              accent="text-blue-600"
            />
            <KpiCard
              label="💰 Custo"
              value={data.kpisAtual.custo}
              prev={data.kpisAnterior.custo}
              accent="text-rose-600"
              inverso
            />
            <KpiCard
              label="📈 Lucro"
              value={data.kpisAtual.lucro}
              prev={data.kpisAnterior.lucro}
              accent="text-emerald-600"
            />
            <KpiCard
              label="📦 Unidades"
              value={data.kpisAtual.vendas}
              prev={data.kpisAnterior.vendas}
              format="number"
            />
            <KpiCard
              label="🎯 Preço médio"
              value={data.derivados.ticketMedio}
              prev={data.derivados.ticketMedioAnterior}
            />
            <KpiCard
              label="📐 Margem"
              value={data.derivados.margemPct}
              prev={data.derivados.margemPctAnterior}
              format="percent"
              accent="text-emerald-600"
            />
            <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-sm p-4 text-white">
              <p className="text-xs uppercase opacity-90">↩️ Devoluções</p>
              <p className="text-lg font-bold">{data.cancelamentos.vendas}</p>
              <p className="text-xs opacity-90">
                {formatCurrency(data.cancelamentos.bruto)} · {data.cancelamentos.taxaPct.toFixed(1)}% das vendas
              </p>
            </div>
          </div>

          {/* Gráfico de tendência */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tendência diária</CardTitle>
              <span className="text-xs text-gray-500">
                {data.timeline.length} dia{data.timeline.length === 1 ? '' : 's'} no período
              </span>
            </CardHeader>
            <CardContent className="pt-0">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timeline} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={formatDateShort}
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)
                    }
                  />
                  <Tooltip
                    formatter={(v: any, name: any) => {
                      const nameStr = String(name);
                      const nameLabel =
                        nameStr === 'Bruto' || nameStr === 'bruto'
                          ? 'Bruto'
                          : nameStr === 'Total Venda' || nameStr === 'totalVenda'
                          ? 'Total Venda'
                          : 'Lucro';
                      return [formatCurrency(Number(v)), nameLabel];
                    }}
                    labelFormatter={(label: any) => {
                      const d = new Date(`${String(label)}T12:00:00`);
                      return d.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      });
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="bruto" stroke="#6366f1" strokeWidth={2} dot={false} name="Bruto" />
                  <Line type="monotone" dataKey="totalVenda" stroke="#3b82f6" strokeWidth={2} dot={false} name="Total Venda" />
                  <Line type="monotone" dataKey="lucro" stroke="#10b981" strokeWidth={2} dot={false} name="Lucro" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            </CardContent>
          </Card>

          {/* Top produtos */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle>Top 10 produtos</CardTitle>
              <div className="flex gap-2">
                <button
                  onClick={() => setTab('lucro')}
                  className={`text-xs px-3 py-1 rounded ${
                    tab === 'lucro'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Por Lucro
                </button>
                <button
                  onClick={() => setTab('bruto')}
                  className={`text-xs px-3 py-1 rounded ${
                    tab === 'bruto'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Por Bruto
                </button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-2">#</th>
                    <th className="text-left px-4 py-2">Produto</th>
                    <th className="text-right px-4 py-2">Qtd</th>
                    <th className="text-right px-4 py-2">Bruto</th>
                    <th className="text-right px-4 py-2">Total Venda</th>
                    <th className="text-right px-4 py-2">Custo</th>
                    <th className="text-right px-4 py-2">Lucro</th>
                    <th className="text-right px-4 py-2">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {topList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-gray-500 py-6">
                        Nenhuma venda no período
                      </td>
                    </tr>
                  ) : (
                    topList.map((p, i) => (
                      <tr key={`${p.productId ?? p.mlListingId ?? 'sem'}-${i}`} className="border-t">
                        <td className="px-4 py-2 text-gray-500 font-mono">{i + 1}</td>
                        <td className="px-4 py-2">
                          <div className="font-medium">{p.name}</div>
                          {p.mlListingId && (
                            <div className="text-xs text-gray-500 font-mono">{p.mlListingId}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">{p.vendas}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(p.bruto)}</td>
                        <td className="px-4 py-2 text-right text-blue-600">{formatCurrency(p.totalVenda)}</td>
                        <td className="px-4 py-2 text-right text-rose-600">
                          {p.custo > 0 ? formatCurrency(p.custo) : '—'}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-semibold ${
                            p.lucro > 0 ? 'text-emerald-600' : p.lucro < 0 ? 'text-red-600' : 'text-gray-400'
                          }`}
                        >
                          {formatCurrency(p.lucro)}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-gray-600">
                          {p.margem.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Comparativo vs período anterior */}
          <Card className="p-4 text-xs text-gray-500">
            Comparativo: {new Date(data.periodoAnterior.from).toLocaleDateString('pt-BR')} até{' '}
            {new Date(data.periodoAnterior.to).toLocaleDateString('pt-BR')}
          </Card>
        </>
      )}
    </div>
  );
}
