"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Package, TrendingUp, DollarSign, Tag, ShoppingCart } from "lucide-react";

export default function Dashboard() {
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Buscar produtos reais do banco de dados
        const res = await fetch('/api/products?limit=1000');
        const data = await res.json();

        if (data.success && data.data) {
          const products = data.data;
          
          // Calcular totais reais
          const prodCount = products.length;
          const stock = products.reduce((sum: number, p: any) => sum + (p.variants?.reduce((s: number, v: any) => s + (v.stock || 0), 0) || 0), 0);
          const value = products.reduce((sum: number, p: any) => {
            return sum + (p.variants?.reduce((s: number, v: any) => s + ((v.salePrice || p.baseSalePrice || 0) * (v.stock || 0)), 0) || 0);
          }, 0);

          const categories = new Set(products.map((p: any) => p.categoryId)).size;

          setTotalProducts(prodCount);
          setTotalStock(stock);
          setTotalValue(value);
          setTotalCategories(categories);
        }
      } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const salesData = [
    { month: "Jan", sales: 12, revenue: 358.8 },
    { month: "Fev", sales: 18, revenue: 538.2 },
    { month: "Mar", sales: 15, revenue: 450.0 },
  ];

  const platformData = [
    { name: "Shopee", value: 598.0, percentage: 44 },
    { name: "Mercado Livre", value: 750.5, percentage: 56 },
  ];

  const COLORS = ["#be185d", "#db2777"];

  const stats = [
    {
      label: "Total de Produtos",
      value: loading ? "..." : totalProducts,
      icon: Package,
      color: "bg-blue-500",
      textColor: "text-blue-600",
    },
    {
      label: "Itens em Estoque",
      value: loading ? "..." : totalStock,
      icon: ShoppingCart,
      color: "bg-green-500",
      textColor: "text-green-600",
    },
    {
      label: "Valor Total (R$)",
      value: loading ? "..." : totalValue.toFixed(2),
      icon: DollarSign,
      color: "bg-yellow-500",
      textColor: "text-yellow-600",
    },
    {
      label: "Categorias",
      value: loading ? "..." : totalCategories,
      icon: Tag,
      color: "bg-purple-500",
      textColor: "text-purple-600",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-admin-900">Dashboard</h1>
        <p className="text-admin-600 mt-2">
          Bem-vindo ao agLivre — gestão ML e Mercado Pago
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border border-admin-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-admin-600 text-sm font-semibold">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold text-admin-900 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg text-white`}>
                  <IconComponent size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Sales Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6">
          <h2 className="text-lg font-bold text-admin-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-primary-600" />
            Vendas por Mês
          </h2>
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

        {/* Platform Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6">
          <h2 className="text-lg font-bold text-admin-900 mb-4">
            Distribuição por Plataforma
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={platformData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} ${value}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {platformData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "0.75rem",
                  color: "#ffffff",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6 mb-8">
        <h2 className="text-lg font-bold text-admin-900 mb-4 flex items-center gap-2">
          <DollarSign size={20} className="text-primary-600" />
          Receita Total por Mês
        </h2>
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
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#be185d"
              strokeWidth={3}
              dot={{ fill: "#be185d", r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Actions and Info */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6">
          <h2 className="text-lg font-bold text-admin-900 mb-4 flex items-center gap-2">
            🚀 Ações Rápidas
          </h2>
          <ul className="space-y-3">
            <li>
              <a
                href="/admin/products"
                className="text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-2 p-2 rounded hover:bg-primary-50 transition"
              >
                ➕ Adicionar novo produto
              </a>
            </li>
            <li>
              <a
                href="/admin/products"
                className="text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-2 p-2 rounded hover:bg-primary-50 transition"
              >
                ✏️ Editar produtos
              </a>
            </li>
            <li>
              <a
                href="/admin/orders"
                className="text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-2 p-2 rounded hover:bg-primary-50 transition"
              >
                📦 Ver pedidos
              </a>
            </li>
            <li>
              <a
                href="/admin/analytics"
                className="text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-2 p-2 rounded hover:bg-primary-50 transition"
              >
                📈 Ver análises
              </a>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6">
          <h2 className="text-lg font-bold text-admin-900 mb-4 flex items-center gap-2">
            📌 Informações
          </h2>
          <div className="space-y-4 text-admin-700">
            <div className="flex justify-between items-center p-2 hover:bg-admin-50 rounded transition">
              <strong>Plataformas:</strong>
              <span className="text-primary-600">Shopee • Mercado Livre</span>
            </div>
            <div className="flex justify-between items-center p-2 hover:bg-admin-50 rounded transition">
              <strong>Categoria:</strong>
              <span className="text-primary-600">Capinhas de Celular</span>
            </div>
            <div className="flex justify-between items-center p-2 hover:bg-admin-50 rounded transition">
              <strong>Status:</strong>
              <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                ✓ Ativo
              </span>
            </div>
            <div className="flex justify-between items-center p-2 hover:bg-admin-50 rounded transition">
              <strong>Data:</strong>
              <span className="text-admin-600">{new Date().toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
