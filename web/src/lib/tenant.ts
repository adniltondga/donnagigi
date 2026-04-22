import prisma from './prisma';

// TODO (Fase 2b): substituir por getCurrentTenantId(session) quando auth
// injetar o tenant do usuário logado. Por enquanto, retorna o primeiro
// tenant do banco — SaaS ainda rodando com um único cliente.
export async function getDefaultTenantId(): Promise<string> {
  const tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!tenant) throw new Error('Nenhum tenant configurado no banco');
  return tenant.id;
}
