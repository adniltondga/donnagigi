import { ProductVariant, Product } from '@prisma/client';

export function calculateVariantCost(
  variant: ProductVariant,
  product: Product,
  marketplace: 'ml' | 'shopee' = 'ml'
): number {
  // Custo de compra: variante ou padrão do produto
  const purchaseCost =
    (variant.purchaseCost ?? 0) > 0 ? variant.purchaseCost : product?.basePurchaseCost ?? 0;

  // Caixa: variante ou padrão do produto
  const boxCost =
    (variant.boxCost ?? 0) > 0 ? variant.boxCost : product?.baseBoxCost ?? 0;

  if (marketplace === 'ml') {
    // Tarifas: SEMPRE do padrão do produto
    const mlTariff = product?.baseMLTariff ?? 0;
    const deliveryTariff = product?.baseDeliveryTariff ?? 0;
    return purchaseCost + boxCost + mlTariff + deliveryTariff;
  } else {
    // Tarifas: SEMPRE do padrão do produto
    const shoppeeTariff = product?.baseShoppeeTariff ?? 0;
    const shopeeDeliveryTariff = product?.baseShopeeDeliveryTariff ?? 0;
    return purchaseCost + boxCost + shoppeeTariff + shopeeDeliveryTariff;
  }
}
