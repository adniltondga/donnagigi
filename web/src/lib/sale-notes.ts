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
  shippingBonus: number;
  saleFeeEstimated: boolean;
}

export function parseSaleNotes(notes: string | null | undefined): SaleNotesParsed {
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
  /** Subsídio ML no frete (list_cost − custo real debitado). Exibição apenas; totalTaxas usa `envio`. */
  shippingBonus: number;
  /**
   * Crédito do ML no pagamento (estorno de bônus / desconto). Apenas
   * `computeBillInPack` calcula a nível de pack (sum(amount) − sum(esperado));
   * `computeSaleNumbers` retorna sempre 0 pra não corromper agregadores que
   * somam `lucro` per-bill (DRE, relatórios v2), porque em pack `bill.amount`
   * per-pedido não bate com `bruto − saleFee − envio_nas_notes` quando o MP
   * atribui o envio só a um dos pedidos do pack.
   */
  estorno: number;
  custo: number;
  totalTaxas: number; // taxaVenda + envio + custo
  /** Bruto líquido de taxas (sem custo de mercadoria). */
  totalVenda: number;
  /** Bruto − taxas + estorno − custo − refunds. */
  liquido: number;
  /** Alias semântico de `liquido` para uso em DRE/relatórios de margem. */
  lucro: number;
  saleFeeEstimated: boolean;
}

export interface SaleBillLike {
  amount: number;
  notes: string | null;
  productCost?: number | null;
  /** Soma dos BillRefund parciais (ml_partial_refund). Reduz o líquido. */
  refundedAmount?: number;
  /**
   * `mlPackId` da Bill. Quando definido, `computeSaleNumbers` retorna
   * `estorno=0` — o estorno per-bill em pack é assimétrico (o MP atribui
   * envio só a uma das bills) e seria errado per-bill; `computeBillInPack`
   * recalcula a nível pack quando o caller precisa exibir.
   */
  mlPackId?: string | null;
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
  const refunded = bill.refundedAmount ?? 0;

  // Estorno (crédito ML) só é inferido pra venda avulsa (sem pack).
  // Checagem ESTRITA: mlPackId === null (caller incluiu no select e veio null).
  // Se for undefined (caller não selecionou) ou string (em pack), pula —
  // evita estimar errado em agregadores que somam s.lucro per-bill sem ter
  // mlPackId no select. Em pack, `computeBillInPack` calcula pack-level.
  //
  // Cap apertado: bônus máximo plausível = envio (refund do frete) +
  // diferença entre tarifa nominal (~18% bruto) e tarifa cobrada (eventual
  // bônus de tarifa ainda não consolidado). Acima disso é bug de sync
  // (`bill.amount` inflado) — não exibe pra não confundir o usuário.
  const NOMINAL_TAXA_RATE = 0.18;
  let estorno = 0;
  if (bill.mlPackId === null && parsed.bruto > 0) {
    const expectedNet = parsed.bruto - parsed.taxaVenda - parsed.envio;
    const estornoRaw = bill.amount - expectedNet;
    const consolidatedTaxaBonus = Math.max(
      0,
      NOMINAL_TAXA_RATE * parsed.bruto - parsed.taxaVenda,
    );
    const cap = parsed.envio + consolidatedTaxaBonus + 0.5;
    if (estornoRaw > 0.5 && estornoRaw <= cap) estorno = estornoRaw;
  }

  const totalVenda = bruto - parsed.taxaVenda - parsed.envio;
  const totalTaxas = parsed.taxaVenda + parsed.envio + custo;
  const liquido = bruto - totalTaxas + estorno - refunded;
  return {
    bruto,
    taxaVenda: parsed.taxaVenda,
    envio: parsed.envio,
    shippingBonus: parsed.shippingBonus,
    estorno,
    custo,
    totalTaxas,
    totalVenda,
    liquido,
    lucro: liquido,
    saleFeeEstimated: parsed.saleFeeEstimated,
  };
}
