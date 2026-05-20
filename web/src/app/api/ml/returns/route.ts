import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { getMLIntegrationForTenant } from '@/lib/ml';
import { listReturns, MLClaimsError } from '@/lib/ml-claims';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ml/returns?limit=50
 *
 * Lista devoluções em andamento (subset das reclamações abertas que
 * já viraram return formal pelo ML). Cada item carrega o `claimId` pro
 * app navegar pra tela do chat.
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantIdOrDefault();
    const integration = await getMLIntegrationForTenant(tenantId);
    if (!integration) {
      return NextResponse.json(
        { error: 'Integração ML não configurada' },
        { status: 404 },
      );
    }

    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Number(sp.get('limit') || 50), 100);

    const result = await listReturns(integration, { limit });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof MLClaimsError) {
      return NextResponse.json(
        { error: 'ML API error', detail: err.bodyExcerpt },
        { status: err.status },
      );
    }
    console.error('[/api/ml/returns] erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'erro' },
      { status: 500 },
    );
  }
}
