import prisma from './prisma';

/**
 * Retorna credenciais do app ML a usar pro tenant. Prioridade:
 *  1) MLAppCredentials do tenant (cliente tem seu próprio app)
 *  2) .env global (ML_CLIENT_ID / ML_CLIENT_SECRET)
 *
 * Lança se nenhum dos dois estiver configurado.
 */
export async function getMLAppCredentials(tenantId: string): Promise<{
  clientId: string;
  clientSecret: string;
  source: 'tenant' | 'env';
}> {
  const creds = await prisma.mLAppCredentials.findUnique({
    where: { tenantId },
  });
  if (creds) {
    return { clientId: creds.clientId, clientSecret: creds.clientSecret, source: 'tenant' };
  }
  const envId = process.env.ML_CLIENT_ID;
  const envSecret = process.env.ML_CLIENT_SECRET;
  if (envId && envSecret) {
    return { clientId: envId, clientSecret: envSecret, source: 'env' };
  }
  throw new Error(
    'Nenhuma credencial ML configurada — cadastre Client ID + Secret em /admin/configuracoes?tab=ml'
  );
}

/**
 * Só retorna o clientId (pra login endpoint, que não precisa do secret).
 */
export async function getMLClientId(tenantId: string): Promise<{
  clientId: string;
  source: 'tenant' | 'env';
} | null> {
  const creds = await prisma.mLAppCredentials.findUnique({
    where: { tenantId },
    select: { clientId: true },
  });
  if (creds) return { clientId: creds.clientId, source: 'tenant' };
  const envId = process.env.ML_CLIENT_ID;
  if (envId) return { clientId: envId, source: 'env' };
  return null;
}
