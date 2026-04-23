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

/**
 * Parseia a description de uma bill de venda ML e extrai as partes.
 * Formato gravado pelo sync: "Venda ML - <title>[ · <var>] [Produto ML: MLB...]"
 * Formato legado: "Venda ML - <title>" (sem variação, sem MLB no final).
 * Se não casar, devolve a string inteira como title (fallback seguro).
 */
export function parseSaleDescription(description: string | null | undefined): {
  title: string
  variation: string | null
  mlListingId: string | null
} {
  const raw = (description || "").trim()
  if (!raw) return { title: "", variation: null, mlListingId: null }

  // MLB pode estar no final entre colchetes ou embutido
  const mlbMatch = raw.match(/MLB\d{6,}/i)
  const mlListingId = mlbMatch?.[0]?.toUpperCase() || null

  // Tira prefixo "Venda ML - " e sufixo "[Produto ML: ...]"
  let body = raw.replace(/^Venda ML\s*-\s*/i, "")
  body = body.replace(/\s*\[Produto ML:[^\]]*\]\s*$/i, "").trim()

  const parts = body.split(" · ")
  const title = (parts[0] || body).trim()
  const variation = parts.length > 1 ? parts.slice(1).join(" · ").trim() : null

  return { title, variation, mlListingId }
}
