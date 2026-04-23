import prisma from './prisma';
import { TRIAL_DAYS, isActive } from './plans';
import type { Subscription } from '@prisma/client';

/**
 * Cria uma Subscription FREE com trial de 14 dias pro tenant recém-criado.
 */
export async function createTrialSubscription(tenantId: string) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
  return prisma.subscription.create({
    data: {
      tenantId,
      plan: 'FREE',
      status: 'TRIAL',
      trialEndsAt,
    },
  });
}

/**
 * Retorna a Subscription do tenant. Se não existir, cria FREE com trial
 * (backward compat com tenants criados antes do schema ter Subscription).
 */
export async function getOrCreateSubscription(tenantId: string): Promise<Subscription> {
  const existing = await prisma.subscription.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return createTrialSubscription(tenantId);
}

/**
 * Quantos dias faltam do trial. Null se não está em trial.
 */
export function trialDaysLeft(sub: Subscription): number | null {
  if (sub.status !== 'TRIAL' || !sub.trialEndsAt) return null;
  const diff = sub.trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Marca trial como EXPIRED quando passou da data. Use em cron ou em
 * request-time quando querer garantir consistência.
 */
export async function syncExpiredTrials(): Promise<number> {
  const now = new Date();
  const res = await prisma.subscription.updateMany({
    where: {
      status: 'TRIAL',
      trialEndsAt: { lt: now },
    },
    data: { status: 'EXPIRED' },
  });
  return res.count;
}

/**
 * Retorna true se o tenant pode usar o produto agora (trial válido ou
 * pagamento confirmado).
 */
export function canUseProduct(sub: Subscription): boolean {
  if (!isActive(sub.status)) return false;
  if (sub.status === 'TRIAL' && sub.trialEndsAt && sub.trialEndsAt < new Date()) {
    return false;
  }
  return true;
}
