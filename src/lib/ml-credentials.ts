import prisma from './prisma';

/**
 * Retorna credenciais do app ML do tenant. Cada cliente deve cadastrar
 * o seu próprio app no DevCenter do ML.
 *
 * Lança se o tenant ainda não cadastrou. SEM fallback global —
 * removido para garantir multi-tenant safety (cota e branding por
 * cliente).
 */
export async function getMLAppCredentials(tenantId: string): Promise<{
  clientId: string;
  clientSecret: string;
}> {
  const creds = await prisma.mLAppCredentials.findUnique({
    where: { tenantId },
  });
  if (creds) {
    return { clientId: creds.clientId, clientSecret: creds.clientSecret };
  }
  throw new Error(
    'App ML não configurado para este tenant — cadastre Client ID + Secret em /admin/configuracoes?tab=ml',
  );
}

/**
 * Só retorna o clientId (pra login endpoint, que não precisa do secret).
 * Retorna null se o tenant não tem credenciais cadastradas.
 */
export async function getMLClientId(tenantId: string): Promise<{
  clientId: string;
} | null> {
  const creds = await prisma.mLAppCredentials.findUnique({
    where: { tenantId },
    select: { clientId: true },
  });
  if (creds) return { clientId: creds.clientId };
  return null;
}
