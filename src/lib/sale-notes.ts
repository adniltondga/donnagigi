/**
 * Parser canônico das notes de Bill de venda ML.
 *
 * Toda agregação/exibição de Bruto, Taxa de venda, Taxa de envio e Lucro
 * em vendas ML deve passar por aqui — evita drift entre páginas, agregadores
 * e crons (foi assim que o bug `sale_fee × quantity` ficou meses sem ser
 * pego em vendas multi-unidade).
 */

const matchAmount = (notes: string | null | undefined, re: RegExp): number => {
  const m = notes?.match(re);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
};

export interface SaleNotesParsed {
  bruto: number;
  taxaVenda: number;
  envio: number;
  saleFeeEstimated: boolean;
}

export function parseSaleNotes(notes: string | null | undefined): SaleNotesParsed {
  return {
    bruto: matchAmount(notes, /Bruto:\s*R\$\s*([\d,.]+)/),
    taxaVenda: matchAmount(notes, /Taxa de venda:\s*R\$\s*([\d,.]+)/),
    envio: matchAmount(notes, /Taxa de envio:\s*R\$\s*([\d,.]+)/),
    saleFeeEstimated: !!notes && /Taxa de venda:.*\(est\.\)/.test(notes),
  };
}

export interface SaleComputed {
  bruto: number;
  taxaVenda: number;
  envio: number;
  custo: number;
  totalTaxas: number; // taxaVenda + envio + custo
  /** Bruto líquido de taxas (sem custo de mercadoria). */
  totalVenda: number;
  /** Bruto − taxas − custo. */
  liquido: number;
  /** Alias semântico de `liquido` para uso em DRE/relatórios de margem. */
  lucro: number;
  saleFeeEstimated: boolean;
}

export interface SaleBillLike {
  amount: number;
  notes: string | null;
  productCost?: number | null;
}

/**
 * Computa os números canônicos de uma venda a partir de um Bill.
 *
 * `Bill.amount` é o LÍQUIDO de taxas (vide `ml-order-sync.ts` →
 * `netAmount = total_amount - saleFee - shippingFee`). Quando `notes`
 * não tem `Bruto:` (vendas muito antigas), reconstrói o bruto somando
 * taxa de venda + envio de volta ao amount.
 */
export function computeSaleNumbers(bill: SaleBillLike): SaleComputed {
  const parsed = parseSaleNotes(bill.notes);
  const bruto =
    parsed.bruto > 0 ? parsed.bruto : bill.amount + parsed.taxaVenda + parsed.envio;
  const custo = bill.productCost ?? 0;
  const totalVenda = bruto - parsed.taxaVenda - parsed.envio;
  const totalTaxas = parsed.taxaVenda + parsed.envio + custo;
  const liquido = bruto - totalTaxas;
  return {
    bruto,
    taxaVenda: parsed.taxaVenda,
    envio: parsed.envio,
    custo,
    totalTaxas,
    totalVenda,
    liquido,
    lucro: liquido,
    saleFeeEstimated: parsed.saleFeeEstimated,
  };
}
