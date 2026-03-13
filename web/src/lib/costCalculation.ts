import { ProductVariant, Product } from '@prisma/client';

export function calculateVariantCost(
  variant: ProductVariant,
  product: Product,
  marketplace: 'ml' | 'shopee' = 'ml'
): number {
  // Se a variação tem valor específico, usa; senão usa o padrão do produto
  const purchaseCost =
    variant.purchaseCost !== undefined && variant.purchaseCost !== null
      ? variant.purchaseCost
      : product?.basePurchaseCost || 0;

  const boxCost =
    variant.boxCost !== undefined && variant.boxCost !== null
      ? variant.boxCost
      : product?.baseBoxCost || 0;

  if (marketplace === 'ml') {
    const mlTariff =
      variant.mlTariff !== undefined && variant.mlTariff !== null
        ? variant.mlTariff
        : product?.baseMLTariff || 0;
    const deliveryTariff =
      variant.deliveryTariff !== undefined && variant.deliveryTariff !== null
        ? variant.deliveryTariff
        : product?.baseDeliveryTariff || 0;
    return purchaseCost + boxCost + mlTariff + deliveryTariff;
  } else {
    const shoppeeTariff =
      variant.shoppeeTariff !== undefined && variant.shoppeeTariff !== null
        ? variant.shoppeeTariff
        : product?.baseShoppeeTariff || 0;
    const shopeeDeliveryTariff =
      variant.shopeeDeliveryTariff !== undefined &&
      variant.shopeeDeliveryTariff !== null
        ? variant.shopeeDeliveryTariff
        : product?.baseShopeeDeliveryTariff || 0;
    return purchaseCost + boxCost + shoppeeTariff + shopeeDeliveryTariff;
  }
}
