/**
 * Cliente HTTP do Asaas (gateway de pagamento brasileiro).
 * Docs: https://docs.asaas.com/
 *
 * Ported do /Users/2480dtidigital/site/agoficina-back/src/infrastructure/services/asaas.service.ts
 * com adaptações pro runtime Next.js (fetch nativo, sem NestJS).
 *
 * Env vars esperadas:
 *  - ASAAS_API_URL (default sandbox)
 *  - ASAAS_API_KEY
 *  - ASAAS_WEBHOOK_TOKEN
 */

export type AsaasBillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD';

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
  email?: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  status: string;
  billingType: string;
  value: number;
  nextDueDate: string;
}

export interface AsaasPayment {
  id: string;
  subscription?: string;
  status: string; // PENDING, CONFIRMED, RECEIVED, OVERDUE, REFUNDED, etc.
  value: number;
  netValue?: number;
  billingType: string;
  dueDate: string;
  paymentDate?: string | null;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
}

function baseUrl() {
  return process.env.ASAAS_API_URL || 'https://api-sandbox.asaas.com/v3';
}

function apiKey() {
  const k = process.env.ASAAS_API_KEY;
  if (!k) throw new Error('ASAAS_API_KEY não configurada');
  return k;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'aglivre',
      access_token: apiKey(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const detail =
      body?.errors?.map((e: any) => e.description).filter(Boolean).join('; ') ||
      body?.message ||
      `${res.status} ${res.statusText}`;
    throw new Error(`ASAAS: ${detail}`);
  }

  return body as T;
}

/**
 * Cria (ou retorna, se já existir via cpfCnpj) um customer no Asaas.
 */
export async function asaasCreateCustomer(data: {
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
}): Promise<AsaasCustomer> {
  const payload: Record<string, unknown> = {
    name: data.name,
    cpfCnpj: data.cpfCnpj.replace(/\D/g, ''),
  };
  if (data.email) payload.email = data.email;
  if (data.mobilePhone) payload.mobilePhone = data.mobilePhone.replace(/\D/g, '');

  return request<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Cria uma subscription mensal no Asaas.
 */
export async function asaasCreateSubscription(data: {
  customerId: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string; // YYYY-MM-DD
  description?: string;
}): Promise<AsaasSubscription> {
  return request<AsaasSubscription>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: data.customerId,
      billingType: data.billingType,
      nextDueDate: data.nextDueDate,
      value: data.value,
      cycle: 'MONTHLY',
      description: data.description ?? 'Assinatura agLivre',
    }),
  });
}

export async function asaasCancelSubscription(subscriptionId: string): Promise<void> {
  await request(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

export async function asaasListSubscriptionPayments(
  subscriptionId: string
): Promise<AsaasPayment[]> {
  const res = await request<{ data: AsaasPayment[] }>(
    `/subscriptions/${subscriptionId}/payments`,
    { method: 'GET' }
  );
  return res.data ?? [];
}

/**
 * Valida o header `asaas-access-token` contra ASAAS_WEBHOOK_TOKEN.
 * Se o env não estiver setado, aceita (mas loga warn — só em dev).
 */
export function asaasValidateWebhookToken(token: string | null): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) {
    console.warn('[asaas] ASAAS_WEBHOOK_TOKEN não configurado — aceitando webhook sem validação');
    return true;
  }
  return token === expected;
}

/**
 * Próxima data de cobrança (primeira): hoje + N dias (default 3).
 */
export function nextDueDateISO(daysFromNow = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}
