/**
 * Junta os atributos de variação do ML num label humano.
 * Ex: [{name:"Cor", value_name:"Preto"}, {name:"Tamanho", value_name:"M"}] → "Preto · M"
 */
export function formatVariationLabel(
  attrs?: Array<{ name?: string; value_name?: string }>
): string {
  if (!attrs || attrs.length === 0) return ""
  return attrs
    .map((a) => (a?.value_name || "").trim())
    .filter(Boolean)
    .join(" · ")
}
