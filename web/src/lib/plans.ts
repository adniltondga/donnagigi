import type { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

/**
 * Catálogo de planos do agLivre. Hardcoded pra evitar seed/config
 * dinâmico. Pra mudar preço, atualizar aqui e comunicar aos clientes.
 */

export interface PlanInfo {
  id: SubscriptionPlan;
  name: string;
  tagline: string;
  priceBRL: number;
  features: string[];
  /**
   * Limite em vendas ML sincronizadas por mês. Undefined = ilimitado.
   */
  maxSalesPerMonth?: number;
  popular?: boolean;
}

export const PLANS: Record<SubscriptionPlan, PlanInfo> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    tagline: 'Pra começar e entender o produto',
    priceBRL: 0,
    maxSalesPerMonth: 30,
    features: [
      'Sincronização com Mercado Livre',
      'Até 30 vendas/mês sincronizadas',
      'Dashboard com KPIs básicos',
      'Relatório de vendas por dia',
      'Email de suporte',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    tagline: 'Pra quem vende de verdade',
    priceBRL: 49,
    popular: true,
    features: [
      'Vendas ilimitadas',
      'Relatório V2 (KPIs, tendências, top produtos)',
      'Previsão de recebimentos',
      'Gestão de custos ML por anúncio',
      'Sincronização com Mercado Pago',
      'Gestão de contas a pagar/receber',
      'Suporte prioritário',
    ],
  },
};

export function planInfo(plan: SubscriptionPlan): PlanInfo {
  return PLANS[plan];
}

/**
 * Status considerados "ativos" — usuário pode usar o produto.
 */
export const ACTIVE_STATUSES: SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'PENDING'];

export function isActive(status: SubscriptionStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Retorna true se o plano dá direito à feature.
 * Extende à medida que adicionarmos gates de plano.
 */
export function hasPro(plan: SubscriptionPlan): boolean {
  return plan === 'PRO';
}

export const TRIAL_DAYS = 14;
