import prisma from './prisma';
import { getMLAppCredentials } from './ml-credentials';

/**
 * Helper central para integrações ML por tenant. Substitui o padrão antigo
 * de `prisma.mLIntegration.findFirst()` espalhado em dezenas de endpoints —
 * esse findFirst sem filtro vazava dados entre tenants quando houvesse mais
 * de um cliente no SaaS.
 */

type MLIntegration = {
  id: string;
  tenantId: string;
  sellerID: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
};

async function refreshTokenIfExpired(integration: MLIntegration): Promise<MLIntegration | null> {
  if (new Date() <= integration.expiresAt) return integration;

  if (!integration.refreshToken) {
    console.error(`[ml] token expirado para tenant ${integration.tenantId} e sem refreshToken`);
    return null;
  }

  // Usa credenciais do tenant (fallback pro .env)
  let clientId: string;
  let clientSecret: string;
  try {
    const c = await getMLAppCredentials(integration.tenantId);
    clientId = c.clientId;
    clientSecret = c.clientSecret;
  } catch (err) {
    console.error(`[ml] sem credenciais pra tenant ${integration.tenantId}:`, err);
    return null;
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: integration.refreshToken,
  });

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    console.error(`[ml] falha ao renovar token do tenant ${integration.tenantId}`);
    return null;
  }

  const data = await res.json();
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);

  const updated = await prisma.mLIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || integration.refreshToken,
      expiresAt,
    },
  });

  console.log(`[ml] token renovado para tenant ${integration.tenantId}`);
  return updated;
}

/**
 * Retorna a MLIntegration do tenant (com token renovado se necessário), ou
 * null se o tenant não tem integração conectada ou o token não pôde ser
 * renovado.
 */
export async function getMLIntegrationForTenant(
  tenantId: string
): Promise<MLIntegration | null> {
  const integration = await prisma.mLIntegration.findFirst({
    where: { tenantId },
  });
  if (!integration) return null;
  return refreshTokenIfExpired(integration);
}

/**
 * Itera sobre todos os tenants que têm MLIntegration configurada, renova o
 * token de cada um e chama o callback. Para usar em endpoints cron/batch
 * que precisam processar múltiplos clientes.
 */
export async function forEachMLTenant(
  fn: (integration: MLIntegration, tenantId: string) => Promise<void>
): Promise<{ processed: number; failed: number }> {
  const integrations = await prisma.mLIntegration.findMany();
  let processed = 0;
  let failed = 0;

  for (const raw of integrations) {
    const refreshed = await refreshTokenIfExpired(raw);
    if (!refreshed) {
      failed++;
      continue;
    }
    try {
      await fn(refreshed, refreshed.tenantId);
      processed++;
    } catch (err) {
      console.error(`[ml] erro no tenant ${refreshed.tenantId}:`, err);
      failed++;
    }
  }

  return { processed, failed };
}
