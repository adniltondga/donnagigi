import prisma from '@/lib/prisma';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { parseSaleNotes } from '@/lib/sale-notes';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Backfill de frete por pack ML.
 *
 * Quando o cliente compra N anúncios diferentes num único carrinho, o ML emite
 * UM shipment mas cria N pedidos. O sync antigo gravava o frete em CADA Bill,
 * multiplicando o frete real por N nos KPIs e DRE.
 *
 * Esta rota normaliza: define âncora (Bill com menor mlOrderId numérico do
 * pack) que carrega o frete; demais Bills do pack têm frete zerado, com
 * `amount` ajustado (amount += envioRemovido) e `notes` reescritas.
 *
 * Bills `cancelled` são ignoradas (têm refunds atrelados ao amount original).
 *
 * Idempotente: rodar 2x não muda nada após a 1ª.
 *
 * Query params:
 *   - dry=1   — não grava, só relata o impacto
 *   - limit=N — máximo de packs processados (default 500, max 2000)
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

  // Caminho A: notes têm a linha canônica "Bruto: ... | Taxas: ... | Líquido: ..."
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

  // Caminho B: vendas antigas sem a linha canônica — apenas mexer na "Taxa de envio:".
  // computeSaleNumbers reconstrói o bruto a partir do amount + saleFee + envio.
  let newNotes = notes.replace(/Taxa de envio:\s*R\$\s*[\d,.]+\s*\n?/, '');
  if (newEnvio > 0) {
    newNotes += `\nTaxa de envio: R$ ${newEnvio.toFixed(2)}`;
  }
  return { newNotes, oldEnvio };
}

interface SampleEntry {
  mlPackId: string;
  anchor: {
    mlOrderId: string;
    envioAntes: number;
    envioDepois: number;
    amountAntes: number;
    amountDepois: number;
  };
  others: Array<{
    mlOrderId: string;
    envioAntes: number;
    envioDepois: number;
    amountAntes: number;
    amountDepois: number;
  }>;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const dry = sp.get('dry') === '1';
    const limit = Math.max(1, Math.min(2000, Number(sp.get('limit')) || 500));
    const tenantId = await getTenantIdOrDefault();

    const packGroups = await prisma.bill.groupBy({
      by: ['mlPackId'],
      where: {
        tenantId,
        type: 'receivable',
        category: 'venda',
        mlPackId: { not: null },
        status: { not: 'cancelled' },
      },
      _count: { _all: true },
    });

    const multiPacks = packGroups
      .filter((g) => g._count._all > 1 && g.mlPackId)
      .slice(0, limit);

    const stats = {
      packsExaminados: multiPacks.length,
      packsCorrigidos: 0,
      billsZeradas: 0,
      billsAnchorAjustadas: 0,
      enviosFantasmaRemovidos: 0,
    };
    const samples: SampleEntry[] = [];

    for (const pack of multiPacks) {
      const mlPackId = pack.mlPackId!;
      const bills = await prisma.bill.findMany({
        where: {
          tenantId,
          type: 'receivable',
          category: 'venda',
          mlPackId,
          status: { not: 'cancelled' },
        },
        select: { id: true, mlOrderId: true, notes: true, amount: true },
      });

      if (bills.length < 2) continue;

      const sorted = [...bills].sort((a, b) => {
        const an = Number((a.mlOrderId || '').replace(/^order_/, '')) || 0;
        const bn = Number((b.mlOrderId || '').replace(/^order_/, '')) || 0;
        return an - bn;
      });
      const anchor = sorted[0];
      const others = sorted.slice(1);

      const envios = bills.map((b) => parseSaleNotes(b.notes).envio);
      const targetEnvio = Math.max(...envios);
      if (targetEnvio === 0) continue;

      const anchorEnvioAtual = parseSaleNotes(anchor.notes).envio;
      const sample: SampleEntry = {
        mlPackId,
        anchor: {
          mlOrderId: anchor.mlOrderId || '',
          envioAntes: anchorEnvioAtual,
          envioDepois: targetEnvio,
          amountAntes: anchor.amount,
          amountDepois: anchor.amount,
        },
        others: [],
      };

      let packTouched = false;

      if (anchorEnvioAtual !== targetEnvio) {
        const { newNotes, oldEnvio } = setShippingInNotes(anchor.notes, targetEnvio);
        const newAmount = anchor.amount + (oldEnvio - targetEnvio);
        sample.anchor.amountDepois = newAmount;
        if (!dry) {
          await prisma.bill.update({
            where: { id: anchor.id },
            data: { amount: newAmount, notes: newNotes },
          });
        }
        stats.billsAnchorAjustadas++;
        packTouched = true;
      }

      for (const b of others) {
        const envioAtual = parseSaleNotes(b.notes).envio;
        if (envioAtual === 0) {
          sample.others.push({
            mlOrderId: b.mlOrderId || '',
            envioAntes: 0,
            envioDepois: 0,
            amountAntes: b.amount,
            amountDepois: b.amount,
          });
          continue;
        }
        const { newNotes, oldEnvio } = setShippingInNotes(b.notes, 0);
        const newAmount = b.amount + oldEnvio;
        if (!dry) {
          await prisma.bill.update({
            where: { id: b.id },
            data: { amount: newAmount, notes: newNotes },
          });
        }
        sample.others.push({
          mlOrderId: b.mlOrderId || '',
          envioAntes: oldEnvio,
          envioDepois: 0,
          amountAntes: b.amount,
          amountDepois: newAmount,
        });
        stats.billsZeradas++;
        stats.enviosFantasmaRemovidos += oldEnvio;
        packTouched = true;
      }

      if (packTouched) {
        stats.packsCorrigidos++;
        if (samples.length < 20) samples.push(sample);
      }
    }

    return NextResponse.json({ success: true, dry, stats, samples });
  } catch (err) {
    console.error('[backfill-pack-shipping] erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
