import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database with product variants...");

  // Limpar dados existentes (opcional)
  await prisma.variantAttributeValue.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.productAttributeValue.deleteMany({});
  await prisma.productAttribute.deleteMany({});
  await prisma.product.deleteMany({});

  // 1. Criar Produto Principal
  const product = await prisma.product.create({
    data: {
      name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera",
      description:
        "Capinha magnética de alta qualidade com protetor de câmera incluso. Disponível em múltiplas cores e modelos de iPhone.",
      baseImage:
        "https://images.unsplash.com/photo-1607936591413-dbe3df3e4aa2?w=400",
      category: "Capinhas",
      supplier: "capa25",
      baseSalePrice: 59.9,
      basePurchaseCost: 18.9,
      baseBoxCost: 2.0,
      active: true,
    },
  });

  console.log("✓ Produto criado:", product.id);

  // 2. Criar Atributos
  const colorAttribute = await prisma.productAttribute.create({
    data: {
      productId: product.id,
      name: "Cor",
      type: "color",
    },
  });

  const modelAttribute = await prisma.productAttribute.create({
    data: {
      productId: product.id,
      name: "Modelo iPhone",
      type: "model",
    },
  });

  console.log("✓ Atributos criados");

  // 3. Criar Valores dos Atributos (Cores)
  const colors = ["Preto", "Rosa", "Cinza", "Roxo", "Marrom"];
  const colorValues = await Promise.all(
    colors.map((color) =>
      prisma.productAttributeValue.create({
        data: {
          attributeId: colorAttribute.id,
          value: color,
        },
      })
    )
  );

  // 4. Criar Valores dos Atributos (Modelos)
  const models = ["iPhone 12 Pro Max", "iPhone 14 Pro Max", "iPhone 15 Pro Max"];
  const modelValues = await Promise.all(
    models.map((model) =>
      prisma.productAttributeValue.create({
        data: {
          attributeId: modelAttribute.id,
          value: model,
        },
      })
    )
  );

  console.log("✓ Valores de atributos criados");

  // 5. Criar Variações
  const variants = [];
  let skuCounter = 1;

  for (const modelValue of modelValues) {
    for (const colorValue of colorValues) {
      const modelShort = modelValue.value.replace(/[^\w]/g, "").substring(0, 6);
      const colorShort = colorValue.value.substring(0, 3).toUpperCase();

      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `CAP-${modelShort}-${colorShort}-${String(skuCounter).padStart(3, "0")}`,
          image: null,
          purchaseCost: 18.9,
          boxCost: 2.0,
          salePrice: 59.9,
          calculatedMargin: ((59.9 - 18.9 - 2.0) / 59.9) * 100,
          stock: Math.floor(Math.random() * 25) + 5, // 5-30 unidades
          mlListed: false,
          active: true,
        },
      });

      // Associar atributos à variante
      await prisma.variantAttributeValue.create({
        data: {
          variantId: variant.id,
          attributeValueId: modelValue.id,
        },
      });

      await prisma.variantAttributeValue.create({
        data: {
          variantId: variant.id,
          attributeValueId: colorValue.id,
        },
      });

      variants.push(variant);
      skuCounter++;
    }
  }

  console.log(`✓ ${variants.length} variações criadas`);

  // 6. Exibir resumo
  console.log("\n📊 Resumo do Produto Criado:");
  console.log(`├── Nome: ${product.name}`);
  console.log(
    `├── Variações: ${variants.length} (${models.length} modelos × ${colors.length} cores)`
  );
  console.log(
    `├── Preço: R$ ${product.baseSalePrice?.toFixed(2) || "N/A"}`
  );
  console.log(
    `├── Estoque Total: ${variants.reduce((sum, v) => sum + (v.stock || 0), 0)} unidades`
  );
  console.log(
    `├── Variação de Estoque: ${Math.min(...variants.map((v) => v.stock || 0))} a ${Math.max(...variants.map((v) => v.stock || 0))} por SKU`
  );
  console.log(
    `└── Atributos: ${
      colorAttribute.name
    } (${colors.length} valores), ${modelAttribute.name} (${models.length} valores)`
  );

  // 7. Exibir algumas variações
  console.log("\n🔍 Primeiras 3 variações criadas:");
  variants.slice(0, 3).forEach((variant, index) => {
    console.log(`   ${index + 1}. SKU: ${variant.sku} | Estoque: ${variant.stock} | Preço: R$ ${variant.salePrice.toFixed(2)}`);
  });

  if (variants.length > 3) {
    console.log(`   ... e mais ${variants.length - 3} variações`);
  }

  console.log("\n✅ Seed completado com sucesso!");
}

main()
  .catch((e) => {
    console.error("❌ Erro ao fazer seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
