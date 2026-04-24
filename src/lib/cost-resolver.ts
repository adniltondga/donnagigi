import prisma from "./prisma";

/**
 * Fonte do custo resolvido.
 * - 'variant' → veio de MLProductVariantCost (match exato por variação)
 * - 'listing' → fallback em MLProductCost (custo geral do anúncio)
 * - null     → nenhum custo cadastrado
 */
export type CostSource = "variant" | "listing" | null;

export interface ResolvedCost {
  cost: number | null;
  source: CostSource;
}

/**
 * Resolve o custo unitário de um item vendido no ML seguindo a cascata:
 *   1. Se variationId presente → busca em MLProductVariantCost
 *   2. Fallback em MLProductCost (custo geral do listing)
 *
 * Todas as queries são escopadas por tenantId — multi-tenant safe.
 *
 * Uso principal: sync-orders e endpoints que precisam abater custo de
 * uma venda. Centraliza a lógica pra não duplicar em 4 lugares.
 */
export async function resolveCost(params: {
  tenantId: string;
  mlListingId: string;
  variationId?: string | number | null;
}): Promise<ResolvedCost> {
  const { tenantId, mlListingId } = params;
  const variationId = params.variationId ? String(params.variationId) : null;

  if (variationId) {
    const variant = await prisma.mLProductVariantCost.findFirst({
      where: { tenantId, mlListingId, variationId },
      select: { productCost: true },
    });
    if (variant && Number.isFinite(variant.productCost)) {
      return { cost: variant.productCost, source: "variant" };
    }
  }

  const listing = await prisma.mLProductCost.findUnique({
    where: { mlListingId },
    select: { productCost: true, tenantId: true },
  });
  // guarda de segurança: MLProductCost usa mlListingId como PK (sem filtro por
  // tenantId), então confirmamos que pertence ao tenant antes de retornar.
  if (listing && listing.tenantId === tenantId && Number.isFinite(listing.productCost)) {
    return { cost: listing.productCost, source: "listing" };
  }

  return { cost: null, source: null };
}

/**
 * Versão em lote: resolve custos pra uma lista de pares (listingId, variationId).
 * Retorna um Map com chave `${listingId}|${variationId || ""}`.
 *
 * Otimiza ao fazer apenas 2 queries (uma por tabela) em vez de N.
 * Usa a mesma cascata: variant precede listing.
 */
export async function resolveCostsBatch(params: {
  tenantId: string;
  items: Array<{ mlListingId: string; variationId?: string | number | null }>;
}): Promise<Map<string, ResolvedCost>> {
  const { tenantId, items } = params;
  const out = new Map<string, ResolvedCost>();
  if (items.length === 0) return out;

  const key = (l: string, v: string | null) => `${l}|${v || ""}`;

  const listingIds = Array.from(new Set(items.map((i) => i.mlListingId)));

  // Variantes: (listingId, variationId) — só pra quem tem variationId
  const variantPairs = items
    .filter((i) => i.variationId != null && i.variationId !== "")
    .map((i) => ({ mlListingId: i.mlListingId, variationId: String(i.variationId) }));

  const [variants, listings] = await Promise.all([
    variantPairs.length > 0
      ? prisma.mLProductVariantCost.findMany({
          where: {
            tenantId,
            OR: variantPairs,
          },
          select: { mlListingId: true, variationId: true, productCost: true },
        })
      : Promise.resolve([] as Array<{ mlListingId: string; variationId: string; productCost: number }>),
    prisma.mLProductCost.findMany({
      where: { tenantId, mlListingId: { in: listingIds } },
      select: { mlListingId: true, productCost: true },
    }),
  ]);

  const variantMap = new Map<string, number>();
  for (const v of variants) variantMap.set(key(v.mlListingId, v.variationId), v.productCost);
  const listingMap = new Map<string, number>();
  for (const l of listings) listingMap.set(l.mlListingId, l.productCost);

  for (const it of items) {
    const vid = it.variationId != null && it.variationId !== "" ? String(it.variationId) : null;
    const k = key(it.mlListingId, vid);
    if (vid) {
      const vcost = variantMap.get(key(it.mlListingId, vid));
      if (vcost != null && Number.isFinite(vcost)) {
        out.set(k, { cost: vcost, source: "variant" });
        continue;
      }
    }
    const lcost = listingMap.get(it.mlListingId);
    if (lcost != null && Number.isFinite(lcost)) {
      out.set(k, { cost: lcost, source: "listing" });
      continue;
    }
    out.set(k, { cost: null, source: null });
  }

  return out;
}
