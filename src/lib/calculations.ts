/**
 * Cálculos financeiros para produtos
 * Margem = Preço de Venda - (Custo Produto + Caixa + Tarifa ML + Tarifa Entrega)
 */

export interface ProductCosts {
  salePrice: number
  purchaseCost: number
  boxCost: number
  mlTariff: number
  deliveryTariff: number
}

/**
 * Calcula o custo total de um produto
 */
export function calculateTotalCost(costs: ProductCosts): number {
  return (
    costs.purchaseCost +
    costs.boxCost +
    costs.mlTariff +
    costs.deliveryTariff
  )
}

/**
 * Calcula a margem bruta de um produto
 * Margem = Preço de Venda - Custo Total
 */
export function calculateMargin(costs: ProductCosts): number {
  const totalCost = calculateTotalCost(costs)
  const margin = costs.salePrice - totalCost
  return Math.round(margin * 100) / 100 // 2 casas decimais
}

/**
 * Calcula o percentual de margem
 */
export function calculateMarginPercent(costs: ProductCosts): number {
  const margin = calculateMargin(costs)
  const percent = (margin / costs.salePrice) * 100
  return Math.round(percent * 100) / 100 // 2 casas decimais
}

/**
 * Valida se os preços fazem sentido
 */
export function validatePricing(costs: ProductCosts): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (costs.salePrice <= 0) {
    errors.push("Preço de venda deve ser maior que zero")
  }

  if (costs.purchaseCost <= 0) {
    errors.push("Custo do produto deve ser maior que zero")
  }

  const totalCost = calculateTotalCost(costs)
  if (costs.salePrice < totalCost) {
    errors.push(
      `Preço (R$ ${costs.salePrice}) é menor que custo total (R$ ${totalCost.toFixed(2)})`
    )
  }

  const marginPercent = calculateMarginPercent(costs)
  if (marginPercent < 0) {
    errors.push("Margem negativa - produto com prejuízo")
  }

  if (marginPercent < 20) {
    errors.push("Aviso: Margem muito baixa (< 20%)")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Formata número como moeda brasileira
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

/**
 * Converte string em formato brasileiro (R$ 1.234,56 ou 1.234,56 ou 1,234.56) para número
 */
export function parseCurrencyString(str: string): number {
  if (!str || typeof str !== 'string') return 0
  
  // Remove espacos e caracteres especiais mantendo números, vírgula e ponto
  const cleaned = str.replace(/[^\d.,]/g, '').trim()
  
  if (!cleaned) return 0
  
  // Se tem ponto e vírgula, a vírgula é o separador decimal (formato brasileiro)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Formato: 1.000,00 ou 1.234,56
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  }
  
  // Se tem só vírgula, é decimal (formato brasileiro)
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return parseFloat(cleaned.replace(',', '.'))
  }
  
  // Se tem só ponto, é decimal (formato anglicano)
  if (cleaned.includes('.') && !cleaned.includes(',')) {
    return parseFloat(cleaned)
  }
  
  // Se não tem ponto nem vírgula, é número inteiro
  return parseFloat(cleaned)
}

/**
 * Exemplo de uso:
 * 
 * const costs = {
 *   salePrice: 59.90,
 *   purchaseCost: 13.32,
 *   boxCost: 0.43,
 *   mlTariff: 10.78,
 *   deliveryTariff: 12.35
 * }
 * 
 * const margin = calculateMargin(costs); // 23.02
 * const marginPercent = calculateMarginPercent(costs); // 38.40%
 * const validation = validatePricing(costs); // { valid: true, errors: [] }
 */
