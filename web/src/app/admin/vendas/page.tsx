'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProductVariant, Product, DeviceModel, DeviceColor } from '@prisma/client';

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
  const [selectedProduct, setSelectedProduct] = useState<ProductWithVariants | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandCostDetails, setExpandCostDetails] = useState(false);

  // Autocomplete
  const [productSearch, setProductSearch] = useState('');
  const [variantSearch, setVariantSearch] = useState('');
  const [openProductDropdown, setOpenProductDropdown] = useState(false);
  const [openVariantDropdown, setOpenVariantDropdown] = useState(false);

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

  // Filtrar produtos
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Filtrar variações do produto selecionado
  const filteredVariants = selectedProduct
    ? selectedProduct.variants.filter(v =>
        `${selectedProduct.name} - ${v.model?.name} (${v.color?.name}) - ${v.cod}`
          .toLowerCase()
          .includes(variantSearch.toLowerCase())
      )
    : [];

  // Selecionar produto
  const handleSelectProduct = (product: ProductWithVariants) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setOpenProductDropdown(false);
    setSelectedVariant(null);
    setVariantSearch('');
    setFormData(prev => ({ ...prev, variantId: '' }));
  };

  // Selecionar variação
  const handleSelectVariant = (variant: any) => {
    setSelectedVariant(variant);
    setFormData(prev => ({
      ...prev,
      variantId: variant.id,
      salePrice: variant.salePrice || 0,
    }));
    setVariantSearch(`${selectedProduct?.name} - ${variant.model?.name} (${variant.color?.name}) - ${variant.cod}`);
    setOpenVariantDropdown(false);
  };

  const calculateVariantCostDetails = useCallback((variant: any) => {
    const product = selectedProduct;
    if (!product) return { purchaseCost: 0, boxCost: 0, platformTariff: 0, deliveryTariff: 0, total: 0, marketplace: formData.marketplace };

    const purchaseCost = (variant.purchaseCost ?? 0) > 0 ? variant.purchaseCost : product.basePurchaseCost ?? 0;
    const boxCost = (variant.boxCost ?? 0) > 0 ? variant.boxCost : product.baseBoxCost ?? 0;

    if (formData.marketplace === 'ml') {
      const mlTariff = product.baseMLTariff ?? 0;
      const deliveryTariff = product.baseDeliveryTariff ?? 0;
      return {
        purchaseCost,
        boxCost,
        platformTariff: mlTariff,
        deliveryTariff,
        total: purchaseCost + boxCost + mlTariff + deliveryTariff,
        marketplace: 'ml',
      };
    } else {
      const shoppeeTariff = product.baseShoppeeTariff ?? 0;
      const shopeeDeliveryTariff = product.baseShopeeDeliveryTariff ?? 0;
      return {
        purchaseCost,
        boxCost,
        platformTariff: shoppeeTariff,
        deliveryTariff: shopeeDeliveryTariff,
        total: purchaseCost + boxCost + shoppeeTariff + shopeeDeliveryTariff,
        marketplace: 'shopee',
      };
    }
  }, [formData.marketplace, selectedProduct]);

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
  }, [formData, selectedVariant, calculateVariantCostDetails]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'saleDate' || name === 'marketplace'
        ? value
        : name === 'quantity' || name === 'daysToReceive'
          ? parseInt(value) || 0
          : value,
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
    <div className="max-w-4xl mx-auto p-6">
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

            {/* Produto */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Produto *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Digite para buscar..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setOpenProductDropdown(true);
                  }}
                  onFocus={() => setOpenProductDropdown(true)}
                  onBlur={() => setTimeout(() => setOpenProductDropdown(false), 150)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
                {openProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProduct(product)}
                        className="w-full text-left px-4 py-2 hover:bg-blue-100 transition border-b last:border-b-0"
                      >
                        {product.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Variação */}
            {selectedProduct && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Variação (Modelo - Cor) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Digite para buscar variação..."
                    value={variantSearch}
                    onChange={(e) => {
                      setVariantSearch(e.target.value);
                      setOpenVariantDropdown(true);
                    }}
                    onFocus={() => setOpenVariantDropdown(true)}
                    onBlur={() => setTimeout(() => setOpenVariantDropdown(false), 150)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                  {openVariantDropdown && filteredVariants.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                      {filteredVariants.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => handleSelectVariant(variant)}
                          className="w-full text-left px-4 py-2 hover:bg-blue-100 transition border-b last:border-b-0"
                        >
                          {variant.model?.name} - {variant.color?.name} (COD: {variant.cod})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

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
            {selectedVariant && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Preço de Venda (R$) *
                </label>
                <div className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(formData.salePrice)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Preço automático da variação: {selectedVariant.cod}
                </p>
              </div>
            )}

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

            {/* Data */}
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

            {/* Button */}
            <button
              type="submit"
              disabled={loading || !selectedVariant}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Registrando...' : 'Registrar Venda'}
            </button>
          </form>
        </div>

        {/* Preview */}
        {preview && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Resumo da Venda</h3>
            <div className="space-y-3 text-sm">
              {/* Custo Total expandível */}
              <div className="border-t pt-3">
                <button
                  type="button"
                  onClick={() => setExpandCostDetails(!expandCostDetails)}
                  className="w-full flex justify-between items-center hover:bg-gray-50 p-2 rounded transition"
                >
                  <span>Custo Total: </span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.totalCost)}</span>
                    <span className={`text-xs transition ${expandCostDetails ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                </button>
                
                {/* Detalhamento do Custo */}
                {expandCostDetails && (
                  <div className="mt-3 p-3 bg-gray-50 rounded space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Custo Compra Unitário:</span>
                      <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.costDetails.purchaseCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Custo Caixa Unitário:</span>
                      <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.costDetails.boxCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tarifa Plataforma Unitária:</span>
                      <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.costDetails.platformTariff)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tarifa Entrega Unitária:</span>
                      <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.costDetails.deliveryTariff)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span className="text-gray-700">Total Unitário:</span>
                      <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.unitCost)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-blue-600">
                      <span>× {formData.quantity} unidades</span>
                      <span>= {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.totalCost)}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between border-t pt-3">
                <span>Faturamento Total:</span>
                <span className="font-semibold text-green-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.totalRevenue)}</span>
              </div>
              
              {/* Lucro Líquido destacado no footer */}
              <div className="border-t pt-3 mt-4 bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Lucro Líquido</p>
                    <p className={`text-2xl font-bold ${preview.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preview.profit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${preview.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {preview.profitMargin.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
