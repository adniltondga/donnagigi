/**
 * One-off: revisita todas as bills com mlOrderId pra detectar trocas
 * (tag "change" no order ML) e setar Bill.isExchange. Útil pra
 * carimbar trocas que sincronizaram antes do campo existir.
 *
 * Idempotente: pula bills já marcadas. Falha silenciosa por bill
 * (network/404 não derruba o batch inteiro).
 *
 * Usage:
 *   npx tsx scripts/backfill-bill-is-exchange.ts        # aplica
 *   npx tsx scripts/backfill-bill-is-exchange.ts dry    # dry-run
 */
import 'dotenv/config';
import prisma from '@/lib/prisma';
import { forEachMLTenant } from '@/lib/ml';

const isDry = process.argv.includes('dry');
const CHUNK_SIZE = 6;

type ProbeResult =
  | { id: string; mlOrderId: string; isExchange: true; tags: string[] }
  | { id: string; mlOrderId: string; isExchange: false }
  | { id: string; mlOrderId: string; error: string };

async function probe(
  bill: { id: string; mlOrderId: string },
  token: string,
): Promise<ProbeResult> {
  const orderRawId = bill.mlOrderId.startsWith('order_')
    ? bill.mlOrderId.slice('order_'.length)
    : bill.mlOrderId;
  try {
    const res = await fetch(
      `https://api.mercadolibre.com/orders/${orderRawId}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    if (!res.ok) {
      return {
        id: bill.id,
        mlOrderId: bill.mlOrderId,
        error: `HTTP ${res.status}`,
      };
    }
    const order = (await res.json()) as { tags?: string[] };
    const tags = Array.isArray(order.tags) ? order.tags : [];
    if (tags.includes('change')) {
      return { id: bill.id, mlOrderId: bill.mlOrderId, isExchange: true, tags };
    }
    return { id: bill.id, mlOrderId: bill.mlOrderId, isExchange: false };
  } catch (err) {
    return {
      id: bill.id,
      mlOrderId: bill.mlOrderId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  await forEachMLTenant(async (integration, tenantId) => {
    console.log(`\n=== tenant ${tenantId} ===`);

    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        mlOrderId: { not: null },
        isExchange: false,
      },
      select: { id: true, mlOrderId: true },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`bills candidatas: ${bills.length}`);
    if (bills.length === 0) return;

    let exchanges = 0;
    let errors = 0;
    let scanned = 0;

    for (let i = 0; i < bills.length; i += CHUNK_SIZE) {
      const chunk = bills.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(
        chunk.map((b) =>
          probe(
            { id: b.id, mlOrderId: b.mlOrderId as string },
            integration.accessToken,
          ),
        ),
      );

      for (const r of results) {
        scanned++;
        if ('error' in r) {
          errors++;
          continue;
        }
        if (r.isExchange) {
          exchanges++;
          console.log(
            `  ↻ ${r.mlOrderId} → troca (tags: ${r.tags.join(', ')})`,
          );
          if (!isDry) {
            await prisma.bill.update({
              where: { id: r.id },
              data: { isExchange: true },
            });
          }
        }
      }

      // Progresso a cada chunk
      if (scanned % 30 === 0 || scanned === bills.length) {
        console.log(
          `  ... ${scanned}/${bills.length} (${exchanges} trocas, ${errors} erros)`,
        );
      }
    }

    console.log(
      `\n${isDry ? '[DRY-RUN] ' : ''}RESUMO: ${exchanges} trocas marcadas, ${errors} erros em ${scanned} bills`,
    );
  });
}

main()
  .catch((e) => {
    console.error('falha:', e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
