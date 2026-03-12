import prisma from './src/lib/prisma'
import { calculateMargin } from './src/lib/calculations'

const novosProducts = [
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 17 Pro Max',
    colorVariant: 'preta',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 16 Pro Max',
    colorVariant: 'cinza',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 16 Pro Max',
    colorVariant: 'preta',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 16 Pro Max',
    colorVariant: 'rosa',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 15 Pro Max',
    colorVariant: 'preta',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 15 Pro Max',
    colorVariant: 'rosa',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 15 Pro Max',
    colorVariant: 'cinza',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 14 Pro Max',
    colorVariant: 'roxo',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 14 Pro Max',
    colorVariant: 'cinza',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 14 Pro Max',
    colorVariant: 'marrom',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 14 Pro Max',
    colorVariant: 'rosa',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 14 Pro Max',
    colorVariant: 'preta',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 12 Pro Max',
    colorVariant: 'rosa',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
  {
    name: 'Capinha Magnética Colorida Fosca com Kit de Película de Câmera - iPhone',
    baseModel: 'iPhone 12 Pro Max',
    colorVariant: 'preta',
    supplier: 'capa25',
    purchaseCost: 13.32,
    boxCost: 0.43,
    mlTariff: 10.78,
    deliveryTariff: 12.35,
    salePrice: 59.9,
    stock: 1,
  },
]

async function main() {
  console.log('🌱 Iniciando seed de novos produtos...')

  // Remover produtos antigos
  await prisma.product.deleteMany({})
  console.log('✓ Produtos antigos removidos')

  // Inserir novos produtos
  for (const productData of novosProducts) {
    const costs = {
      purchaseCost: productData.purchaseCost,
      boxCost: productData.boxCost,
      mlTariff: productData.mlTariff,
      deliveryTariff: productData.deliveryTariff,
      salePrice: productData.salePrice,
    }

    const calculatedMargin = calculateMargin(costs)

    await prisma.product.create({
      data: {
        ...productData,
        description: `Capinha magnética fosca com kit de película de câmera para ${productData.baseModel} na cor ${productData.colorVariant}`,
        image: 'https://via.placeholder.com/300x300?text=Capinha+Magnética',
        category: 'Capinhas',
        minStock: 5,
        calculatedMargin,
      },
    })

    console.log(
      `✓ ${productData.baseModel} - ${productData.colorVariant} (Margem: R$ ${calculatedMargin.toFixed(2)})`
    )
  }

  // Calcular resumo
  const allProducts = await prisma.product.findMany()
  const totalCost = allProducts.reduce(
    (sum, p) =>
      sum + (p.purchaseCost + p.boxCost + p.mlTariff + p.deliveryTariff) * p.stock,
    0
  )
  const totalRevenue = allProducts.reduce((sum, p) => sum + p.salePrice * p.stock, 0)
  const totalMargin = totalRevenue - totalCost

  console.log(`\n✅ Seed concluído! ${allProducts.length} produtos inseridos`)
  console.log(`\n📊 Resumo:`)
  console.log(`Total de SKUs: ${allProducts.length}`)
  console.log(`Estoque total: ${allProducts.reduce((sum, p) => sum + p.stock, 0)} unidades`)
  console.log(`Receita total (se vender tudo): R$ ${totalRevenue.toFixed(2)}`)
  console.log(`Custo total (se vender tudo): R$ ${totalCost.toFixed(2)}`)
  console.log(`Margem total (se vender tudo): R$ ${totalMargin.toFixed(2)}`)
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
