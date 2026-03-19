'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProductVariant, Product, DeviceModel, DeviceColor } from '@prisma/client';
import CurrencyInput from '@/components/CurrencyInput';

interface ProductWithVariants extends Product {
  variants: (ProductVariant & {
    model: DeviceModel | null;
    color: DeviceColor | null;
  })[];
}

interface SaleFormData {
  variantId: string;
  quantity: number;
  salePrice: number;
  marketplace: 'ml' | 'shopee';
  saleDate: string;
  daysToReceive: number;
}

export default function VendasPage() {
  const [formData, setFormData] = useState<SaleFormData>({
    variantId: '',
    quantity: 1,
    salePrice: 0,
    marketplace: 'ml',
    saleDate: new Date().toISOString().split('T')[0],
    daysToReceive: 3,
  });

  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Carregar produtos ao montar
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products');
        if (response.ok) {
          const data = await response.json();
          setProducts(data.data);
        }
      } catch (error) {
        console.error('Erro ao carregar produtos:', error);
      }
    };

    fetchProducts();
  }, []);

  const calculateVariantCostDetails = useCallback((variant: any) => {
    // Custo de compra: variante ou padrão do produto
    const purchaseCost =
      (variant.purchaseCost ?? 0) > 0 ? variant.purchaseCost : variant.product?.basePurchaseCost ?? 0;

    // Caixa: variante ou padrão do produto
    const boxCost =
      (variant.boxCost ?? 0) > 0 ? variant.boxCost : variant.product?.baseBoxCost ?? 0;

    if (formData.marketplace === 'ml') {
      // Tarifas: SEMPRE do padrão do produto
      const mlTariff = variant.product?.baseMLTariff ?? 0;
      const deliveryTariff = variant.product?.baseDeliveryTariff ?? 0;
      return {
        purchaseCost,
        boxCost,
        platformTariff: mlTariff,
        deliveryTariff,
        total: purchaseCost + boxCost + mlTariff + deliveryTariff,
        marketplace: 'ml',
      };
    } else {
      // Tarifas: SEMPRE do padrão do produto
      const shoppeeTariff = variant.product?.baseShoppeeTariff ?? 0;
      const shopeeDeliveryTariff = variant.product?.baseShopeeDeliveryTariff ?? 0;
      return {
        purchaseCost,
        boxCost,
        platformTariff: shoppeeTariff,
        deliveryTariff: shopeeDeliveryTariff,
        total: purchaseCost + boxCost + shoppeeTariff + shopeeDeliveryTariff,
        marketplace: 'shopee',
      };
    }
  }, [formData.marketplace]);

  const calculateVariantCost = useCallback((variant: any): number => {
    return calculateVariantCostDetails(variant).total;
  }, [calculateVariantCostDetails]);

  // Atualizar preview quando form mudar
  useEffect(() => {
    if (!selectedVariant || !formData.salePrice) {
      setPreview(null);
      return;
    }

    const costDetails = calculateVariantCostDetails(selectedVariant);
    const unitCost = costDetails.total;
    const totalCost = unitCost * formData.quantity;
    const totalRevenue = formData.salePrice * formData.quantity;
    const profit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    setPreview({
      unitCost,
      totalCost,
      totalRevenue,
      profit,
      profitMargin,
      costDetails,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, selectedVariant, calculateVariantCostDetails]);

  const handleVariantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const variantId = e.target.value;
    setFormData({ ...formData, variantId });

    if (variantId) {
      const variant = products
        .flatMap((p) => p.variants.map((v) => ({ ...v, product: p })))
        .find((v) => v.id === variantId);
      setSelectedVariant(variant);
    } else {
      setSelectedVariant(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'saleDate' || name === 'marketplace'
        ? value
        : name === 'quantity' || name === 'daysToReceive'
          ? parseInt(value) || 0
          : parseFloat(value) || 0,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Venda registrada com sucesso!' });
        setFormData({
          variantId: '',
          quantity: 1,
          salePrice: 0,
          marketplace: 'ml',
          saleDate: new Date().toISOString().split('T')[0],
          daysToReceive: 3,
        });
        setSelectedVariant(null);
        setPreview(null);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao registrar venda' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao conectar com o servidor' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">📊 Registrar Venda</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            {message && (
              <div
                className={`p-4 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Variação */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Produto / Variação *
              </label>
              <select
                value={formData.variantId}
                onChange={handleVariantChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="">Selecione uma variação</option>
                {products.flatMap((product) =>
                  product.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {product.name} - {variant.model?.name} ({variant.color?.name}) - {variant.cod}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Quantidade */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Quantidade *
              </label>
              <input
                type="number"
                name="quantity"
                min="1"
                step="1"
                value={formData.quantity}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            {/* Preço de Venda */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Preço de Venda (R$) *
              </label>
              <CurrencyInput
                value={formData.salePrice}
                onChange={(value) => setFormData((prev) => ({ ...prev, salePrice: value }))}
                required
              />
            </div>

            {/* Marketplace */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Marketplace *
              </label>
              <select
                name="marketplace"
                value={formData.marketplace}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="ml">Mercado Livre</option>
                <option value="shopee">Shopee</option>
              </select>
            </div>

            {/* Data da Venda */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data da Venda
              </label>
              <input
                type="date"
                name="saleDate"
                value={formData.saleDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Prazo de Recebimento */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Prazo de Recebimento (dias)
              </label>
              <input
                type="number"
                name="daysToReceive"
                min="0"
                step="1"
                value={formData.daysToReceive}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Registrando...' : '✅ Registrar Venda'}
            </button>
          </form>
        </div>

        {/* Preview */}
        {preview && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow p-6 h-fit sticky top-8">
            <h3 className="font-semibold text-gray-900 mb-4">📈 Preview</h3>

            <div className="space-y-3">
              {/* Breakdown de Custos */}
              <div className="bg-white rounded p-3 border border-gray-200">
                <p className="text-xs font-bold text-gray-700 mb-2">DETALHAMENTO DE CUSTOS:</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Custo Compra:</span>
                    <span>R$ {preview.costDetails.purchaseCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Custo Caixa:</span>
                    <span>R$ {preview.costDetails.boxCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Taxa {preview.costDetails.marketplace === 'ml' ? 'ML' : 'Shopee'}:</span>
                    <span>R$ {preview.costDetails.platformTariff.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Taxa Envio:</span>
                    <span>R$ {preview.costDetails.deliveryTariff.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-1 flex justify-between font-semibold text-gray-900">
                    <span>Custo Unitário:</span>
                    <span>R$ {preview.unitCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Custo Total ({formData.quantity}x):</span>
                <span className="font-semibold">R$ {preview.totalCost.toFixed(2)}</span>
              </div>

              <div className="border-t border-gray-300 pt-3 flex justify-between">
                <span className="text-gray-600">Faturamento:</span>
                <span className="font-semibold text-lg">R$ {preview.totalRevenue.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Lucro Bruto:</span>
                <span className={`font-semibold text-lg ${preview.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  R$ {preview.profit.toFixed(2)}
                </span>
              </div>

              <div className="bg-white rounded p-3 flex justify-between">
                <span className="text-gray-700 font-semibold">Margem de Lucro:</span>
                <span className={`text-lg font-bold ${preview.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {preview.profitMargin.toFixed(1)}%
                </span>
              </div>

              <div className="flex justify-between text-sm text-gray-500">
                <span>Vencimento estimado:</span>
                <span>
                  {(() => {
                    const d = new Date(formData.saleDate);
                    d.setDate(d.getDate() + formData.daysToReceive);
                    return d.toLocaleDateString('pt-BR');
                  })()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
