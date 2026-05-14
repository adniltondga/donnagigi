/**
 * Port do parser de notes de Bill de venda ML do web (src/lib/sale-notes.ts
 * + src/lib/ml-format.ts). Mantém a fórmula EXATA — qualquer divergência
 * entre web e app é bug.
 */

const matchAmount = (notes: string | null | undefined, re: RegExp): number => {
  const m = notes?.match(re);
  return m ? parseFloat(m[1].replace(',', '.')) : 0;
};

export interface SaleNotesParsed {
  bruto: number;
  taxaVenda: number;
  envio: number;
  shippingBonus: number;
  saleFeeEstimated: boolean;
}

export function parseSaleNotes(
  notes: string | null | undefined,
): SaleNotesParsed {
  return {
    bruto: matchAmount(notes, /Bruto:\s*R\$\s*([\d,.]+)/),
    taxaVenda: matchAmount(notes, /Taxa de venda:\s*R\$\s*([\d,.]+)/),
    envio: matchAmount(notes, /Taxa de envio:\s*R\$\s*([\d,.]+)/),
    shippingBonus: matchAmount(notes, /Bônus envio:\s*R\$\s*([\d,.]+)/),
    saleFeeEstimated: !!notes && /Taxa de venda:.*\(est\.\)/.test(notes),
  };
}

export interface SaleComputed {
  bruto: number;
  taxaVenda: number;
  envio: number;
  shippingBonus: number;
  custo: number;
  totalTaxas: number;
  totalVenda: number;
  liquido: number;
  lucro: number;
  saleFeeEstimated: boolean;
}

export interface SaleBillLike {
  amount: number;
  notes?: string | null;
  productCost?: number | null;
  refundedAmount?: number;
}

export function computeSaleNumbers(bill: SaleBillLike): SaleComputed {
  const parsed = parseSaleNotes(bill.notes);
  const bruto =
    parsed.bruto > 0
      ? parsed.bruto
      : bill.amount + parsed.taxaVenda + parsed.envio;
  const custo = bill.productCost ?? 0;
  const refunded = bill.refundedAmount ?? 0;
  const totalVenda = bruto - parsed.taxaVenda - parsed.envio;
  const totalTaxas = parsed.taxaVenda + parsed.envio + custo;
  const liquido = bruto - totalTaxas - refunded;
  return {
    bruto,
    taxaVenda: parsed.taxaVenda,
    envio: parsed.envio,
    shippingBonus: parsed.shippingBonus,
    custo,
    totalTaxas,
    totalVenda,
    liquido,
    lucro: liquido,
    saleFeeEstimated: parsed.saleFeeEstimated,
  };
}

/**
 * Pack ML chega como N bills com o mesmo mlPackId. A bill âncora carrega o
 * frete inteiro no `notes`; pra exibir o lucro real de cada item, ratea-se
 * o frete pro-rata por bruto. Espelha `computeBillInPack` do web
 * (web/src/app/admin/relatorios/vendas-ml/page.tsx).
 */
export function computeBillInPack(
  bill: SaleBillLike,
  packBills: SaleBillLike[],
): SaleComputed {
  const billRaw = computeSaleNumbers(bill);
  const sums = packBills.reduce(
    (acc, x) => {
      const sx = computeSaleNumbers(x);
      acc.bruto += sx.bruto;
      acc.envio += sx.envio;
      acc.shippingBonus += sx.shippingBonus;
      return acc;
    },
    { bruto: 0, envio: 0, shippingBonus: 0 },
  );
  const ratio = sums.bruto > 0 ? billRaw.bruto / sums.bruto : 1 / packBills.length;
  const envio = sums.envio * ratio;
  const shippingBonus = sums.shippingBonus * ratio;
  const totalVenda = billRaw.bruto - billRaw.taxaVenda - envio;
  const totalTaxas = billRaw.taxaVenda + envio + billRaw.custo;
  const liquido = billRaw.bruto - totalTaxas - (bill.refundedAmount ?? 0);
  return {
    bruto: billRaw.bruto,
    taxaVenda: billRaw.taxaVenda,
    envio,
    shippingBonus,
    custo: billRaw.custo,
    totalVenda,
    totalTaxas,
    liquido,
    lucro: liquido,
    saleFeeEstimated: billRaw.saleFeeEstimated,
  };
}

/**
 * Quebra a descrição "Venda ML - <título> · <variação> [Produto ML: MLB...]"
 * em partes mais úteis pra exibição.
 */
export function parseSaleDescription(description: string | null | undefined): {
  title: string;
  variation: string | null;
  mlListingId: string | null;
} {
  const raw = (description || '').trim();
  const mlbMatch = raw.match(/MLB\d{6,}/i);
  const mlListingId = mlbMatch?.[0]?.toUpperCase() || null;
  let body = raw.replace(/^Venda ML\s*-\s*/i, '');
  body = body.replace(/\s*\[Produto ML:[^\]]*\]\s*$/i, '').trim();
  const parts = body.split(' · ');
  const title = (parts[0] || body).trim();
  const variation =
    parts.length > 1 ? parts.slice(1).join(' · ').trim() : null;
  return { title, variation, mlListingId };
}
