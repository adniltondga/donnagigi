import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { getMLIntegrationForTenant } from '@/lib/ml';
import { sendClaimMessage, MLClaimsError } from '@/lib/ml-claims';

export const dynamic = 'force-dynamic';

const MAX_MESSAGE_CHARS = 2000;

/**
 * POST /api/ml/claims/:id/messages
 * Body: { message: string }
 *
 * Envia mensagem texto pra thread da claim. Limita o tamanho a 2000 chars
 * (defesa em profundidade — a UI também valida).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const claimId = params.id;
    if (!claimId || !/^\d+$/.test(claimId)) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    const json = (await req.json()) as { message?: unknown };
    const message =
      typeof json?.message === 'string' ? json.message.trim() : '';

    if (!message) {
      return NextResponse.json(
        { error: 'mensagem obrigatória' },
        { status: 400 },
      );
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `mensagem maior que ${MAX_MESSAGE_CHARS} caracteres` },
        { status: 400 },
      );
    }

    const tenantId = await getTenantIdOrDefault();
    const integration = await getMLIntegrationForTenant(tenantId);
    if (!integration) {
      return NextResponse.json(
        { error: 'Integração ML não configurada' },
        { status: 404 },
      );
    }

    const sent = await sendClaimMessage(integration, claimId, message);
    return NextResponse.json(sent);
  } catch (err) {
    if (err instanceof MLClaimsError) {
      return NextResponse.json(
        { error: 'ML API error', detail: err.bodyExcerpt },
        { status: err.status },
      );
    }
    console.error('[/api/ml/claims/:id/messages POST] erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'erro' },
      { status: 500 },
    );
  }
}
