import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import type { UserRole } from '@prisma/client';
import prisma from './prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'seu_jwt_secret_super_seguro'
);

export interface SessionPayload {
  id: string;
  email: string;
  tenantId: string;
  role: UserRole;
  /** ID da row em Session (jti do JWT). Sempre presente em sessões
   *  vindas do cookie web (getSession). Ausente em tokens da extensão
   *  (Bearer) que não usam Session. */
  sessionId?: string;
}

/**
 * Lê o JWT do cookie `token` e retorna o payload.
 * Retorna null se não logado, token inválido, ou a Session foi revogada/expirou.
 *
 * Tokens antigos (pré-roles) não têm `role` — nesse caso consultamos
 * o banco pra hidratar. Na próxima troca de token (login/refresh) o
 * payload já virá completo.
 *
 * Tokens pré-Session (sem jti) são tratados como inválidos — usuário
 * precisa relogar. JWT antigo continua válido só até a próxima checagem
 * de getSession, que rejeita por falta de jti.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get('token')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.id || !payload.tenantId) return null;

    const sessionId = typeof payload.jti === 'string' ? payload.jti : null;
    if (!sessionId) return null;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, expiresAt: true, userId: true },
    });
    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;
    if (session.userId !== String(payload.id)) return null;

    let role = payload.role as UserRole | undefined;
    if (!role) {
      const user = await prisma.user.findUnique({
        where: { id: String(payload.id) },
        select: { role: true },
      });
      role = user?.role;
    }
    if (!role) return null;

    return {
      id: String(payload.id),
      email: String(payload.email || ''),
      tenantId: String(payload.tenantId),
      role,
      sessionId,
    };
  } catch {
    return null;
  }
}

/**
 * Retorna o tenantId do usuário logado. Lança se não houver sessão.
 * Use em API routes/server components de áreas autenticadas.
 */
export async function getCurrentTenantId(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error('Não autenticado');
  return session.tenantId;
}

/**
 * Fallback pra fluxos sem sessão (ex: webhooks ML que não passam por
 * user). Retorna o primeiro tenant — TODO: webhooks receberão tenantId
 * via secret/query string quando houver múltiplos clientes.
 */
export async function getDefaultTenantId(): Promise<string> {
  const tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!tenant) throw new Error('Nenhum tenant configurado no banco');
  return tenant.id;
}

/**
 * Tenta getCurrentTenantId (session); se falhar, cai pro default.
 * Útil em rotas de transição — remover na Fase 4+ quando auth estiver
 * 100% cravada.
 */
export async function getTenantIdOrDefault(): Promise<string> {
  try {
    return await getCurrentTenantId();
  } catch {
    return await getDefaultTenantId();
  }
}

/**
 * Gera um slug único pra Tenant a partir de um nome base.
 * Se já existir, adiciona sufixo curto.
 */
export async function generateUniqueTenantSlug(base: string): Promise<string> {
  const slugBase = base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'tenant';

  // Tenta o slug base primeiro
  const existing = await prisma.tenant.findUnique({ where: { slug: slugBase } });
  if (!existing) return slugBase;

  // Colisão: adiciona sufixo aleatório
  for (let i = 0; i < 5; i++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${slugBase}-${suffix}`;
    const clash = await prisma.tenant.findUnique({ where: { slug: candidate } });
    if (!clash) return candidate;
  }
  throw new Error('Falha ao gerar slug único de tenant');
}
