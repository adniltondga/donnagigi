import prisma from "./prisma"

/**
 * Formata o nome de uma variação com seus atributos
 * Ex: "Capinha... - iPhone 14 Pro Max - Preto"
 */
export async function formatVariantName(
  productName: string,
  variantId: string
): Promise<string> {
  const variantAttributes = await prisma.variantAttributeValue.findMany({
    where: { variantId },
    include: {
      attributeValue: true,
    },
  });

  const attributeValues = variantAttributes
    .map((va) => va.attributeValue.value)
    .join(" - ");

  return `${productName} - ${attributeValues}`;
}

/**
 * Obter todas as variações de um produto com seus atributos
 */
export async function getProductVariants(productId: string) {
  return prisma.productVariant.findMany({
    where: { productId, active: true },
    include: {
      attributes: {
        include: {
          attributeValue: {
            include: {
              attribute: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Filtrar variações por atributos
 * Ex: { "Cor": "Preto", "Modelo iPhone": "iPhone 14 Pro Max" }
 */
export async function filterVariants(
  productId: string,
  filters: Record<string, string>
) {
  const variants = await getProductVariants(productId);

  return variants.filter((variant) => {
    const variantAttrs = variant.attributes.reduce(
      (acc, va) => {
        const attrName = va.attributeValue.attribute.name;
        const attrValue = va.attributeValue.value;
        acc[attrName] = attrValue;
        return acc;
      },
      {} as Record<string, string>
    );

    return Object.entries(filters).every(
      ([key, value]) => variantAttrs[key] === value
    );
  });
}

/**
 * Obter resumo de estoque de um produto
 */
export async function getProductStockSummary(productId: string) {
  const variants = await getProductVariants(productId);

  const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  const lowStockVariants = variants.filter((v) => (v.stock || 0) < 5);
  const outOfStockVariants = variants.filter((v) => (v.stock || 0) === 0);

  return {
    totalStock,
    totalVariants: variants.length,
    lowStockCount: lowStockVariants.length,
    outOfStockCount: outOfStockVariants.length,
    lowStockVariants: lowStockVariants.map((v) => ({
      cod: v.cod,
      stock: v.stock,
      salePrice: v.salePrice,
    })),
    outOfStockVariants: outOfStockVariants.map((v) => ({
      cod: v.cod,
      salePrice: v.salePrice,
    })),
  };
}

/**
 * Criar uma variação com atributos
 */
export async function createVariant(
  productId: string,
  data: {
    cod: string;
    salePrice: number;
    stock?: number;
    purchaseCost?: number;
    boxCost?: number;
    attributes: Record<string, string>; // { "Cor": "Preto", "Modelo": "iPhone 14" }
  }
) {
  // Verificar se COD já existe
  const existingCod = await prisma.productVariant.findUnique({
    where: { cod: data.cod },
  });

  if (existingCod) {
    throw new Error(`COD ${data.cod} já existe`);
  }

  // Criar variante
  const variant = await prisma.productVariant.create({
    data: {
      productId,
      cod: data.cod,
      salePrice: data.salePrice,
      stock: data.stock || 0,
      purchaseCost: data.purchaseCost,
      boxCost: data.boxCost,
    },
  });

  // Associar atributos
  for (const [attrName, attrValue] of Object.entries(data.attributes)) {
    // Encontrar o atributo
    const attribute = await prisma.productAttribute.findFirst({
      where: {
        productId,
        name: attrName,
      },
    });

    if (!attribute) {
      throw new Error(`Atributo "${attrName}" não existe para este produto`);
    }

    // Encontrar ou criar o valor do atributo
    let attributeValue = await prisma.productAttributeValue.findFirst({
      where: {
        attributeId: attribute.id,
        value: attrValue,
      },
    });

    if (!attributeValue) {
      attributeValue = await prisma.productAttributeValue.create({
        data: {
          attributeId: attribute.id,
          value: attrValue,
        },
      });
    }

    // Associar valor ao atributo da variante
    await prisma.variantAttributeValue.create({
      data: {
        variantId: variant.id,
        attributeValueId: attributeValue.id,
      },
    });
  }

  return variant;
}

/**
 * Atualizar estoque de uma variação
 */
export async function updateVariantStock(
  variantId: string,
  newStock: number
) {
  return prisma.productVariant.update({
    where: { id: variantId },
    data: { stock: newStock },
  });
}

/**
 * Obter margem de lucro de uma variação
 */
export function calculateMargin(
  salePrice: number,
  purchaseCost: number = 0,
  boxCost: number = 0
): number {
  const totalCost = purchaseCost + boxCost;
  if (totalCost === 0) return 0;
  return ((salePrice - totalCost) / salePrice) * 100;
}

/**
 * Obter estatísticas de vendas por variação (para análise)
 */
export async function getVariantSalesStats(
  productId: string
) {
  const variants = await prisma.productVariant.findMany({
    where: { productId },
    include: {
      orderItems: {
        select: {
          quantity: true,
          price: true,
        },
      },
    },
  });

  return variants.map((v) => {
    const totalSold = v.orderItems.reduce((sum, oi) => sum + oi.quantity, 0);
    const totalRevenue = v.orderItems.reduce(
      (sum, oi) => sum + oi.price * oi.quantity,
      0
    );

    return {
      cod: v.cod,
      totalSold,
      totalRevenue,
      averagePrice: totalSold > 0 ? totalRevenue / totalSold : 0,
      currentStock: v.stock,
    };
  });
}
