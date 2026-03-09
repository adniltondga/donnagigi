"use client";

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, Percent, Target } from "lucide-react";

export default function AnalyticsAdmin() {
  const salesData = [
    { month: "Janeiro", sales: 12, revenue: 358.8 },
    { month: "Fevereiro", sales: 18, revenue: 538.2 },
    { month: "Março", sales: 15, revenue: 450.0 },
  ];

  const topProducts = [
    { name: "Capinha Rosa Premium", sales: 8, revenue: 239.2 },
    { name: "Capinha Transparente", sales: 7, revenue: 174.3 },
    { name: "Capinha Floral", sales: 5, revenue: 164.5 },
  ];

  const platformStats = [
    { name: "Shopee", orders: 20, revenue: 598.0, growth: "+15%" },
    { name: "Mercado Livre", orders: 25, revenue: 750.5, growth: "+22%" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-admin-900">Análise</h1>
        <p className="text-admin-600 mt-2">
          Acompanhe o desempenho do seu negócio
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-admin-600 text-sm font-semibold">Total de Vendas</p>
              <p className="text-3xl font-bold text-admin-900 mt-2">45</p>
              <p className="text-blue-600 text-sm mt-2">+12% vs mês anterior</p>
            </div>
            <TrendingUp className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-admin-600 text-sm font-semibold">Receita Total</p>
              <p className="text-3xl font-bold text-admin-900 mt-2">R$ 1.348,50</p>
              <p className="text-green-600 text-sm mt-2">+18% vs mês anterior</p>
            </div>
            <DollarSign className="text-green-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-admin-600 text-sm font-semibold">Ticket Médio</p>
              <p className="text-3xl font-bold text-admin-900 mt-2">R$ 29,97</p>
              <p className="text-yellow-600 text-sm mt-2">+5% vs mês anterior</p>
            </div>
            <Target className="text-yellow-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-admin-600 text-sm font-semibold">Taxa de Conversão</p>
              <p className="text-3xl font-bold text-admin-900 mt-2">18,5%</p>
              <p className="text-primary-600 text-sm mt-2">+2.3% vs mês anterior</p>
            </div>
            <Percent className="text-primary-500" size={32} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Sales Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6">
          <h2 className="text-lg font-bold text-admin-900 mb-4">📊 Vendas por Mês</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "0.75rem",
                  color: "#ffffff",
                }}
              />
              <Bar dataKey="sales" fill="#be185d" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6">
          <h2 className="text-lg font-bold text-admin-900 mb-4">💰 Receita por Mês</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "0.75rem",
                  color: "#ffffff",
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#db2777"
                strokeWidth={3}
                dot={{ fill: "#db2777", r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Platform Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6 mb-8">
        <h2 className="text-lg font-bold text-admin-900 mb-4">🎯 Performance das Plataformas</h2>
        <div className="space-y-4">
          {platformStats.map((platform, index) => (
            <div
              key={index}
              className="p-4 bg-admin-50 rounded-lg border border-admin-200 hover:border-primary-300 transition"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-admin-900 text-lg">{platform.name}</h3>
                <span className="text-green-600 font-bold text-sm bg-green-50 px-3 py-1 rounded-full">
                  {platform.growth}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex gap-6">
                  <div>
                    <p className="text-admin-600 text-sm">Pedidos</p>
                    <p className="text-2xl font-bold text-admin-900">{platform.orders}</p>
                  </div>
                  <div>
                    <p className="text-admin-600 text-sm">Faturamento</p>
                    <p className="text-2xl font-bold text-primary-600">R$ {platform.revenue.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6">
        <h2 className="text-lg font-bold text-admin-900 mb-4">⭐ Produtos Mais Vendidos</h2>
        <div className="space-y-3">
          {topProducts.map((product, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-admin-50 rounded-lg border border-admin-200 hover:bg-primary-50 transition"
            >
              <div className="flex-1">
                <p className="font-semibold text-admin-900">{product.name}</p>
                <p className="text-sm text-admin-600">{product.sales} unidades vendidas</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary-600 text-lg">R$ {product.revenue.toFixed(2)}</p>
                <p className="text-xs text-admin-600">Faturamento</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
