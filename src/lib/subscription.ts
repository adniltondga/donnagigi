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
 * Marca trial como EXPIRED + downgrade pro FREE quando passou da data.
 * Use em cron ou em request-time quando querer garantir consistência.
 */
export async function syncExpiredTrials(): Promise<number> {
  const now = new Date();
  const res = await prisma.subscription.updateMany({
    where: {
      status: 'TRIAL',
      trialEndsAt: { lt: now },
    },
    data: { status: 'EXPIRED', plan: 'FREE' },
  });
  return res.count;
}

/**
 * Subscriptions OVERDUE há N dias (default 7) viram EXPIRED + FREE.
 * O ASAAS já tentou cobrar 3x antes de virar OVERDUE; depois desse
 * grace period, downgrade definitivo.
 */
export async function expireOverdueSubscriptions(daysThreshold = 7): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysThreshold);
  const res = await prisma.subscription.updateMany({
    where: {
      status: 'OVERDUE',
      updatedAt: { lt: cutoff },
    },
    data: { status: 'EXPIRED', plan: 'FREE' },
  });
  return res.count;
}

/**
 * Subscriptions CANCELED com fim de ciclo passado viram EXPIRED + FREE.
 * Cliente cancelou mas ainda tem acesso pago até currentPeriodEnd —
 * passou disso, downgrade pro FREE.
 */
export async function expireCanceledPastPeriod(): Promise<number> {
  const now = new Date();
  const res = await prisma.subscription.updateMany({
    where: {
      status: 'CANCELED',
      currentPeriodEnd: { lt: now },
    },
    data: { status: 'EXPIRED', plan: 'FREE' },
  });
  return res.count;
}

/**
 * Retorna true se o tenant pode usar o produto agora.
 *
 * Estados de acesso:
 *  - TRIAL: válido até trialEndsAt
 *  - ACTIVE / PENDING: sempre OK
 *  - CANCELED: continua válido até currentPeriodEnd (cliente pagou
 *    o ciclo, usa até o fim — padrão da indústria)
 *  - OVERDUE: bloqueia imediatamente (estimula resolver pagamento)
 *  - EXPIRED: bloqueia (deveria já estar em plan=FREE)
 */
export function canUseProduct(sub: Subscription): boolean {
  if (sub.status === 'TRIAL') {
    return !!sub.trialEndsAt && sub.trialEndsAt > new Date();
  }
  if (sub.status === 'ACTIVE' || sub.status === 'PENDING') return true;
  if (sub.status === 'CANCELED') {
    return !!sub.currentPeriodEnd && sub.currentPeriodEnd > new Date();
  }
  return false;
}

// isActive importada mas não usada após refactor — reexporta pra
// não quebrar callers existentes.
void isActive;
