/**
 * Junta os atributos de variação do ML num label humano.
 * Ex: [{name:"Cor", value_name:"Preto"}, {name:"Tamanho", value_name:"M"}] → "Preto · M"
 *
 * Ordena os atributos pelo `name` (Cor, Modelo, Tamanho…) pra manter a
 * ordem estável entre pedidos — o ML devolve o array em ordem variável,
 * o que causava duplicatas no ranking ("Azul · Modelo" vs "Modelo · Azul").
 */
export function formatVariationLabel(
  attrs?: Array<{ name?: string; value_name?: string }>
): string {
  if (!attrs || attrs.length === 0) return ""
  return [...attrs]
    .sort((a, b) => (a?.name || "").localeCompare(b?.name || ""))
    .map((a) => (a?.value_name || "").trim())
    .filter(Boolean)
    .join(" · ")
}

/**
 * Chave canônica pra agrupar vendas com a mesma variação, mesmo que a
 * string exibida tenha vindo em ordem/capitalização diferente
 * (case insensitive + valores em ordem alfabética).
 */
export function normalizeVariationKey(variation: string | null | undefined): string {
  if (!variation) return ""
  return variation
    .split(" · ")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(" · ")
}
