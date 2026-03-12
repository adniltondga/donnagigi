import { PrismaClient } from "@prisma/client"
import { calculateMargin } from "./src/lib/calculations"

const prisma = new PrismaClient()

/**
 * Dados da planilha DonnaGigi
 * Capinhas Magnéticas com Kit de Película de Câmera - iPhone
 */
const productsData = [
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 17 Pro Max",
    colorVariant: "preta",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 16 Pro Max",
    colorVariant: "cinza",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 16 Pro Max",
    colorVariant: "preta",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 16 Pro Max",
    colorVariant: "rosa",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 15 Pro Max",
    colorVariant: "preta",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 15 Pro Max",
    colorVariant: "rosa",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 15 Pro Max",
    colorVariant: "cinza",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 14 Pro Max",
    colorVariant: "roxo",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 14 Pro Max",
    colorVariant: "cinza",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 14 Pro Max",
    colorVariant: "marrom",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 14 Pro Max",
    colorVariant: "rosa",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 14 Pro Max",
    colorVariant: "preta",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 12 Pro Max",
    colorVariant: "rosa",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
  {
    name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone",
    description:
      "Capinha magnética com acabamento fosco e kit completo de películas de câmera",
    baseModel: "iPhone 12 Pro Max",
    colorVariant: "preta",
    supplier: "capa25",
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 40,
  },
]

async function main() {
  console.log("🌱 Iniciando seed de produtos...")

  // Limpar produtos existentes
  await prisma.product.deleteMany()
  console.log("✓ Produtos antigos removidos")

  // Inserir novos produtos
  for (const productData of productsData) {
    const costs = {
      salePrice: productData.salePrice,
      purchaseCost: productData.purchaseCost,
      boxCost: productData.boxCost,
      mlTariff: productData.mlTariff,
      deliveryTariff: productData.deliveryTariff,
    }

    const calculatedMargin = calculateMargin(costs)

    await prisma.product.create({
      data: {
        ...productData,
        image: "https://via.placeholder.com/300x300?text=Capinha+Magnética",
        category: "Capinhas",
        minStock: 5,
        calculatedMargin,
      },
    })

    console.log(
      `✓ ${productData.baseModel} - ${productData.colorVariant} (Margem: R$ ${calculatedMargin.toFixed(2)})`
    )
  }

  console.log(`\n✅ Seed concluído! ${productsData.length} produtos inseridos`)

  // Mostrar resumo
  const products = await prisma.product.findMany()
  console.log("\n📊 Resumo:")
  console.log(`Total de SKUs: ${products.length}`)
  console.log(
    `Estoque total: ${products.reduce((sum, p) => sum + p.stock, 0)} unidades`
  )

  const totalRevenue = products.reduce((sum, p) => sum + p.salePrice, 0)
  const totalCosts = products.reduce(
    (sum, p) =>
      sum +
      (p.purchaseCost + p.boxCost + p.mlTariff + p.deliveryTariff),
    0
  )

  console.log(
    `Receita total (se vender tudo): R$ ${totalRevenue.toFixed(2)}`
  )
  console.log(`Custo total (se vender tudo): R$ ${totalCosts.toFixed(2)}`)
  console.log(
    `Margem total (se vender tudo): R$ ${(totalRevenue - totalCosts).toFixed(2)}`
  )
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
