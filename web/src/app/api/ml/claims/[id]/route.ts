import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { getMLIntegrationForTenant } from '@/lib/ml';
import { getClaim, getClaimMessages, MLClaimsError } from '@/lib/ml-claims';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ml/claims/:id
 *
 * Retorna detalhe + thread completa de mensagens da claim. Faz 2 chamadas
 * à API ML em paralelo (claim + messages).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const claimId = params.id;
    if (!claimId || !/^\d+$/.test(claimId)) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    const tenantId = await getTenantIdOrDefault();
    const integration = await getMLIntegrationForTenant(tenantId);
    if (!integration) {
      return NextResponse.json(
        { error: 'Integração ML não configurada' },
        { status: 404 },
      );
    }

    const [claim, messages] = await Promise.all([
      getClaim(integration, claimId),
      getClaimMessages(integration, claimId),
    ]);

    return NextResponse.json({ claim, messages });
  } catch (err) {
    if (err instanceof MLClaimsError) {
      return NextResponse.json(
        { error: 'ML API error', detail: err.bodyExcerpt },
        { status: err.status },
      );
    }
    console.error('[/api/ml/claims/:id] erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'erro' },
      { status: 500 },
    );
  }
}
