import { parseSaleDescription } from "@/lib/ml-format"

interface ProductLabelProps {
  /** Título do produto (sem "Venda ML - ..." — se precisar parsear, use `description`). */
  title?: string
  /** Variação: "Azul · iPhone 15PM". Vira um badge. */
  variation?: string | null
  /** MLB do anúncio — renderizado em fonte mono abaixo. */
  mlListingId?: string | null
  /**
   * Atalho: passa a description bruta da bill ("Venda ML - X · Y [Produto ML: MLB...]")
   * que o componente parseia sozinho.
   */
  description?: string | null
  /** Controla tamanho do título. */
  size?: "sm" | "md"
  /** Esconde MLB mesmo se existir (útil quando a tabela já tem coluna MLB). */
  hideMlb?: boolean
  /** Se true, title aparece em 1 linha com ellipsis (default: 2 linhas). */
  singleLine?: boolean
  /** Quantidade vendida — quando > 1, mostra badge "× N" ao lado da variação. */
  quantity?: number
}

/**
 * Componente único pra renderizar "<Título do produto>\n<Variação em badge>\n<MLB mono>".
 * Usado em vendas-ml, relatórios, top produtos e dashboard — unifica o
 * visual do produto+variação em todo lugar.
 */
export function ProductLabel({
  title,
  variation,
  mlListingId,
  description,
  size = "md",
  hideMlb,
  singleLine,
  quantity,
}: ProductLabelProps) {
  let resolvedTitle = title
  let resolvedVariation: string | null | undefined = variation
  let resolvedMlb: string | null | undefined = mlListingId

  if (description && (!resolvedTitle || resolvedVariation === undefined)) {
    const parsed = parseSaleDescription(description)
    if (!resolvedTitle) resolvedTitle = parsed.title
    if (resolvedVariation === undefined) resolvedVariation = parsed.variation
    if (!resolvedMlb) resolvedMlb = parsed.mlListingId
  }

  const titleCls =
    size === "sm"
      ? "text-sm font-medium text-gray-900"
      : "text-sm font-semibold text-gray-900"
  const clampCls = singleLine ? "line-clamp-1" : "line-clamp-2"

  const showQty = typeof quantity === "number" && quantity > 1

  return (
    <div className="min-w-0">
      <div className={`${titleCls} ${clampCls}`}>{resolvedTitle || "—"}</div>
      {(resolvedVariation || showQty) && (
        <div className="flex flex-wrap items-center gap-1 mt-1">
          {resolvedVariation && (
            <span className="inline-block text-xs text-primary-700 bg-primary-50 border border-primary-100 rounded px-1.5 py-0.5">
              {resolvedVariation}
            </span>
          )}
          {showQty && (
            <span className="inline-flex items-center text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5">
              × {quantity}
            </span>
          )}
        </div>
      )}
      {!hideMlb && resolvedMlb && (
        <div className="text-xs text-gray-500 font-mono mt-0.5">{resolvedMlb}</div>
      )}
    </div>
  )
}
