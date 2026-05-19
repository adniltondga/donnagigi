import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { getMLIntegrationForTenant } from '@/lib/ml';
import { listClaims, listClaimsEnriched, MLClaimsError } from '@/lib/ml-claims';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ml/claims?status=opened&limit=50&offset=0
 *
 * Lista reclamações em aberto do vendedor do tenant logado.
 * Default: status=opened, limit=50.
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
    const status = sp.get('status') === 'closed' ? 'closed' : 'opened';
    const limit = Math.min(Number(sp.get('limit') || 50), 100);
    const offset = Math.max(Number(sp.get('offset') || 0), 0);
    const enrich = sp.get('enrich') === 'last_message';

    const result = enrich
      ? await listClaimsEnriched(integration, { status, limit, offset })
      : await listClaims(integration, { status, limit, offset });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof MLClaimsError) {
      return NextResponse.json(
        { error: 'ML API error', detail: err.bodyExcerpt },
        { status: err.status },
      );
    }
    console.error('[/api/ml/claims] erro:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'erro' },
      { status: 500 },
    );
  }
}
