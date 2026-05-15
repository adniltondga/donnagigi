import prisma from '@/lib/prisma';
import { parseSaleNotes } from '@/lib/sale-notes';

/**
 * Normalização de frete por pack ML.
 *
 * Quando o cliente compra N anúncios diferentes num único carrinho, o ML emite
 * UM shipment mas cria N pedidos. Como cada pedido é sincronizado isoladamente
 * (webhook ou cron), uma race condition entre 2 syncs pode gravar a mesma taxa
 * de envio em TODAS as Bills do pack — o que quebra a rateio do display
 * (`computeBillInPack` divide a soma de envios pelo bruto e, com envio
 * duplicado, a divisão "se cancela" e mostra o frete inteiro).
 *
 * `normalizePackShipping` força o "modelo âncora" no campo `notes`: a Bill
 * com menor `mlOrderId` numérico do pack carrega o frete; as demais ficam com
 * `Taxa de envio` zerada. Isso é suficiente pro display (`computeSaleNumbers`
 * lê de `notes`) e pra todos os agregadores que somam `bill.amount` separado.
 *
 * **NÃO mexe em `bill.amount`**. O amount canônico já é definido na sync
 * (preferindo `mpNet` por pagamento, que é per-pedido e não duplica). Tocar
 * no amount aqui poderia somar/zerar errado quando o MP override já normalizou.
 *
 * Bills `cancelled` são preservadas — têm refunds atrelados e não devem ser
 * tocadas.
 *
 * Idempotente: rodar 2× não muda nada após a 1ª. Sem efeito em vendas avulsas
 * (sem `mlPackId`) — essa função só é chamada quando há pack.
 */

function rewriteVendasLine(
  notes: string,
  bruto: number,
  taxaVenda: number,
  saleFeeEstimated: boolean,
  envio: number,
): string {
  const newTotal = taxaVenda + envio;
  const newLiquido = bruto - newTotal;
  const taxBreakdown = [
    taxaVenda > 0
      ? `Taxa de venda: R$ ${taxaVenda.toFixed(2)}${saleFeeEstimated ? ' (est.)' : ''}`
      : '',
    envio > 0 ? `Taxa de envio: R$ ${envio.toFixed(2)}` : '',
  ]
    .filter(Boolean)
    .join(' + ');
  const newLine = taxBreakdown
    ? `Bruto: R$ ${bruto.toFixed(2)} | Taxas: ${taxBreakdown} (Total: R$ ${newTotal.toFixed(2)}) | Líquido: R$ ${newLiquido.toFixed(2)}`
    : `Bruto: R$ ${bruto.toFixed(2)} | Líquido: R$ ${newLiquido.toFixed(2)}`;
  return notes.replace(/Bruto:\s*R\$[^\n]+/, newLine);
}

function setShippingInNotes(
  notes: string | null,
  newEnvio: number,
): { newNotes: string | null; oldEnvio: number } {
  if (!notes) return { newNotes: notes, oldEnvio: 0 };
  const parsed = parseSaleNotes(notes);
  if (parsed.envio === newEnvio) return { newNotes: notes, oldEnvio: parsed.envio };

  const oldEnvio = parsed.envio;

  if (/Bruto:\s*R\$[^\n]+/.test(notes)) {
    const newNotes = rewriteVendasLine(
      notes,
      parsed.bruto,
      parsed.taxaVenda,
      parsed.saleFeeEstimated,
      newEnvio,
    );
    return { newNotes, oldEnvio };
  }

  let newNotes = notes.replace(/Taxa de envio:\s*R\$\s*[\d,.]+\s*\n?/, '');
  if (newEnvio > 0) {
    newNotes += `\nTaxa de envio: R$ ${newEnvio.toFixed(2)}`;
  }
  return { newNotes, oldEnvio };
}

export interface NormalizePackShippingResult {
  /** Pack tinha 2+ bills não-canceladas e foi tocado. */
  touched: boolean;
  /** Bills com frete-fantasma zeradas (notes). */
  billsZeradas: number;
  /** Bill âncora teve frete ajustado (notes). */
  anchorAjustada: boolean;
  /** Soma de frete removido das bills não-âncora (notes). */
  enviosFantasmaRemovidos: number;
}

/**
 * Normaliza o frete de um único pack. Idempotente.
 *
 * Chamada após criar uma Bill com `mlPackId` em syncMLOrder e no cron sync-orders.
 * Também usado pela rota de backfill (varre todos os packs).
 */
export async function normalizePackShipping(params: {
  tenantId: string;
  mlPackId: string;
  dry?: boolean;
}): Promise<NormalizePackShippingResult> {
  const { tenantId, mlPackId, dry = false } = params;

  const bills = await prisma.bill.findMany({
    where: {
      tenantId,
      type: 'receivable',
      category: 'venda',
      mlPackId,
      status: { not: 'cancelled' },
    },
    select: { id: true, mlOrderId: true, notes: true },
  });

  const result: NormalizePackShippingResult = {
    touched: false,
    billsZeradas: 0,
    anchorAjustada: false,
    enviosFantasmaRemovidos: 0,
  };

  if (bills.length < 2) return result;

  const sorted = [...bills].sort((a, b) => {
    const an = Number((a.mlOrderId || '').replace(/^order_/, '')) || 0;
    const bn = Number((b.mlOrderId || '').replace(/^order_/, '')) || 0;
    return an - bn;
  });
  const anchor = sorted[0];
  const others = sorted.slice(1);

  const envios = bills.map((b) => parseSaleNotes(b.notes).envio);
  const targetEnvio = Math.max(...envios);
  if (targetEnvio === 0) return result;

  const anchorEnvioAtual = parseSaleNotes(anchor.notes).envio;

  if (anchorEnvioAtual !== targetEnvio) {
    const { newNotes } = setShippingInNotes(anchor.notes, targetEnvio);
    if (!dry) {
      await prisma.bill.update({
        where: { id: anchor.id },
        data: { notes: newNotes },
      });
    }
    result.anchorAjustada = true;
    result.touched = true;
  }

  for (const b of others) {
    const envioAtual = parseSaleNotes(b.notes).envio;
    if (envioAtual === 0) continue;
    const { newNotes, oldEnvio } = setShippingInNotes(b.notes, 0);
    if (!dry) {
      await prisma.bill.update({
        where: { id: b.id },
        data: { notes: newNotes },
      });
    }
    result.billsZeradas++;
    result.enviosFantasmaRemovidos += oldEnvio;
    result.touched = true;
  }

  return result;
}
