"use client";

import { Package, Truck, CheckCircle, Clock } from "lucide-react";

export default function OrdersAdmin() {
  const orders = [
    {
      id: "ORD-001",
      customer: "Cliente 1",
      total: 104.70,
      status: "delivered",
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toLocaleDateString(
        "pt-BR"
      ),
      platform: "Shopee",
      items: 2,
    },
    {
      id: "ORD-002",
      customer: "Cliente 2",
      total: 64.80,
      status: "shipped",
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString(
        "pt-BR"
      ),
      platform: "Mercado Livre",
      items: 1,
    },
    {
      id: "ORD-003",
      customer: "Cliente 3",
      total: 94.70,
      status: "processing",
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toLocaleDateString(
        "pt-BR"
      ),
      platform: "Shopee",
      items: 3,
    },
  ];

  const statusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-700 border border-green-300";
      case "shipped":
        return "bg-blue-100 text-blue-700 border border-blue-300";
      case "processing":
        return "bg-yellow-100 text-yellow-700 border border-yellow-300";
      case "pending":
        return "bg-gray-100 text-gray-700 border border-gray-300";
      default:
        return "bg-gray-100 text-gray-700 border border-gray-300";
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle size={18} />;
      case "shipped":
        return <Truck size={18} />;
      case "processing":
        return <Clock size={18} />;
      case "pending":
        return <Package size={18} />;
      default:
        return <Package size={18} />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "delivered":
        return "Entregue";
      case "shipped":
        return "Enviado";
      case "processing":
        return "Processando";
      case "pending":
        return "Pendente";
      default:
        return status;
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-admin-900">Pedidos</h1>
        <p className="text-admin-600 mt-2">Acompanhe todos os pedidos dos clientes</p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-admin-600 text-sm font-semibold">Total de Pedidos</p>
              <p className="text-3xl font-bold text-admin-900 mt-2">3</p>
            </div>
            <Package className="text-blue-500" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-admin-600 text-sm font-semibold">Entregues</p>
              <p className="text-3xl font-bold text-admin-900 mt-2">1</p>
            </div>
            <CheckCircle className="text-green-500" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-admin-600 text-sm font-semibold">Processando</p>
              <p className="text-3xl font-bold text-admin-900 mt-2">1</p>
            </div>
            <Clock className="text-yellow-500" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-admin-200 p-6 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-admin-600 text-sm font-semibold">Faturamento Total</p>
              <p className="text-3xl font-bold text-admin-900 mt-2">R$ 264,20</p>
            </div>
            <Truck className="text-primary-500" size={32} />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-admin-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-100 border-b border-admin-300">
              <tr>
                <th className="px-6 py-4 text-left text-admin-900 font-bold">ID do Pedido</th>
                <th className="px-6 py-4 text-left text-admin-900 font-bold">Cliente</th>
                <th className="px-6 py-4 text-left text-admin-900 font-bold">Data</th>
                <th className="px-6 py-4 text-left text-admin-900 font-bold">Plataforma</th>
                <th className="px-6 py-4 text-left text-admin-900 font-bold">Itens</th>
                <th className="px-6 py-4 text-left text-admin-900 font-bold">Total</th>
                <th className="px-6 py-4 text-left text-admin-900 font-bold">Status</th>
                <th className="px-6 py-4 text-left text-admin-900 font-bold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-admin-200 hover:bg-admin-50 transition">
                  <td className="px-6 py-4 font-semibold text-primary-600">{order.id}</td>
                  <td className="px-6 py-4 text-admin-900 font-medium">{order.customer}</td>
                  <td className="px-6 py-4 text-admin-700">{order.date}</td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-3 py-1 bg-admin-100 text-admin-700 rounded-full text-sm font-semibold">
                      {order.platform}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-admin-900 font-medium">{order.items}</td>
                  <td className="px-6 py-4 font-bold text-primary-600">
                    R$ {order.total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold w-fit ${statusColor(order.status)}`}>
                      {statusIcon(order.status)}
                      {statusLabel(order.status)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2">
                      👁️ Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
