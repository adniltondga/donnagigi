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
  /**
   * Limite de usuários no tenant. Undefined = ilimitado.
   */
  maxUsers?: number;
  popular?: boolean;
  /**
   * Plano não tem checkout self-service — UI mostra "Fale com a gente"
   * em vez do botão Assinar. Usado pra ENTERPRISE (negociado).
   */
  contactOnly?: boolean;
  /**
   * Label customizado pro preço quando não é número formatado direto
   * (ex: "Sob consulta" pro Enterprise).
   */
  priceLabel?: string;
  /**
   * Link de contato pra planos contactOnly (mailto, formulário, etc).
   */
  contactHref?: string;
}

export const PLANS: Record<SubscriptionPlan, PlanInfo> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    tagline: 'Pra começar e enxergar seu lucro real',
    priceBRL: 0,
    maxSalesPerMonth: 30,
    maxUsers: 1,
    features: [
      'Até 30 vendas/mês sincronizadas',
      'Sincronização com Mercado Livre',
      'Dashboard, vendas por dia e listagem de vendas ML',
      'Custos por anúncio e variação (lucro real)',
      'Relatórios',
      'Pró-labore seguro',
      'Contas a pagar / a receber + categorias',
      'Top produtos e potencial de estoque',
      'Export CSV',
      'Histórico de 6 meses',
      '1 usuário',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    tagline: 'Conecte com o Mercado Pago e cresça',
    priceBRL: 49,
    maxSalesPerMonth: 300,
    maxUsers: 3,
    popular: true,
    features: [
      'Até 300 vendas/mês sincronizadas',
      'Tudo do Free',
      'Mercado Pago — saldo a liberar e cronograma diário',
      'Retidos por reclamação separados',
      'Previsão de recebimentos',
      'Histórico ilimitado',
      'Multi-usuário (até 3)',
      'Suporte via ticket — resposta em 24h',
    ],
  },
  BUSINESS: {
    id: 'BUSINESS',
    name: 'Business',
    tagline: 'Mobile + Chrome pra operação séria',
    priceBRL: 99,
    maxSalesPerMonth: 1000,
    maxUsers: 5,
    features: [
      'Até 1.000 vendas/mês sincronizadas',
      'Tudo do Pro',
      'Extensão Chrome — sync 1-click direto do anúncio (em breve)',
      'App mobile (PWA) com push de vendas e devoluções',
      'Multi-usuário (até 5)',
      'Suporte via ticket — prioridade alta',
    ],
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'Operação grande com volume customizado',
    priceBRL: 0, // negociado caso a caso
    priceLabel: 'Sob consulta',
    contactOnly: true,
    contactHref: 'mailto:comercial@dgadigital.com.br?subject=Plano%20Enterprise%20agLivre',
    features: [
      'Vendas ilimitadas',
      'Tudo do Business',
      'Multi-usuário ilimitado',
      'Webhooks e API customizados',
      'SLA com suporte dedicado',
    ],
  },
};

export function planInfo(plan: SubscriptionPlan): PlanInfo {
  return PLANS[plan];
}

/**
 * Planos que têm checkout self-service (sem ENTERPRISE).
 */
export const CHECKOUTABLE_PLANS: SubscriptionPlan[] = ['PRO', 'BUSINESS'];

export function isCheckoutable(plan: SubscriptionPlan): boolean {
  return CHECKOUTABLE_PLANS.includes(plan);
}

/**
 * Status considerados "ativos" — usuário pode usar o produto.
 */
export const ACTIVE_STATUSES: SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'PENDING'];

export function isActive(status: SubscriptionStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Retorna true se o plano dá direito a features Pro+ (Pro/Business/Enterprise).
 * Extende à medida que adicionarmos gates de plano.
 */
export function hasPro(plan: SubscriptionPlan): boolean {
  return plan === 'PRO' || plan === 'BUSINESS' || plan === 'ENTERPRISE';
}

export const TRIAL_DAYS = 14;
