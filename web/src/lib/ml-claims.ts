/**
 * Wrapper sobre a Post-Purchase Claims API do Mercado Livre.
 * Endpoints:
 *   GET  /post-purchase/v1/claims/search
 *   GET  /post-purchase/v1/claims/{id}
 *   GET  /post-purchase/v1/claims/{id}/messages
 *   POST /post-purchase/v1/claims/{id}/messages
 *
 * Padrão: as funções recebem o objeto integration já refrescado
 * (vide getMLIntegrationForTenant). Tipos foram derivados do shape
 * real retornado pela API ML em 2026-05-19 (vide
 * scripts/check-ml-claims-scope.ts).
 */

type Integration = {
  accessToken: string;
  sellerID: string;
};

const ML_BASE = 'https://api.mercadolibre.com';

export type MLClaimPlayer = {
  role: 'complainant' | 'respondent' | 'mediator';
  type: 'buyer' | 'seller' | 'internal';
  userId: number;
  availableActions: string[];
};

/** Item da listagem (subset do detalhe). */
export type MLClaimListItem = {
  id: number;
  resourceId: number;
  resource: string;
  status: string; // opened | closed | ...
  type: string; // mediations | claims | ...
  stage: string; // dispute | claim | ...
  reasonId: string | null;
  parentId: number | null;
  fulfilled: boolean;
  quantityType: string | null;
  dateCreated: string;
  lastUpdated: string;
};

/** Detalhe completo (lista + players + resolution + related). */
export type MLClaimDetail = MLClaimListItem & {
  claimedQuantity: number;
  claimVersion: number;
  players: MLClaimPlayer[];
  resolution: unknown | null;
  siteId: string;
  relatedEntities: string[];
};

export type MLClaimMessage = {
  senderRole: string; // respondent (seller) | complainant (buyer) | mediator
  receiverRole: string;
  message: string; // texto cru (pode conter HTML)
  dateCreated?: string;
  attachments?: unknown[];
};

type RawClaim = {
  id: number;
  resource_id: number;
  resource: string;
  status: string;
  type: string;
  stage: string;
  parent_id: number | null;
  reason_id: string | null;
  fulfilled: boolean;
  quantity_type: string | null;
  claimed_quantity?: number;
  claim_version?: number;
  players?: Array<{
    role: MLClaimPlayer['role'];
    type: MLClaimPlayer['type'];
    user_id: number;
    available_actions?: string[];
  }>;
  resolution?: unknown;
  site_id?: string;
  related_entities?: string[];
  date_created: string;
  last_updated: string;
};

type RawMessage = {
  sender_role: string;
  receiver_role: string;
  message: string;
  date_created?: string;
  attachments?: unknown[];
};

function normalizeListItem(r: RawClaim): MLClaimListItem {
  return {
    id: r.id,
    resourceId: r.resource_id,
    resource: r.resource,
    status: r.status,
    type: r.type,
    stage: r.stage,
    reasonId: r.reason_id ?? null,
    parentId: r.parent_id ?? null,
    fulfilled: r.fulfilled,
    quantityType: r.quantity_type ?? null,
    dateCreated: r.date_created,
    lastUpdated: r.last_updated,
  };
}

function normalizeDetail(r: RawClaim): MLClaimDetail {
  return {
    ...normalizeListItem(r),
    claimedQuantity: r.claimed_quantity ?? 0,
    claimVersion: r.claim_version ?? 0,
    players: (r.players ?? []).map((p) => ({
      role: p.role,
      type: p.type,
      userId: p.user_id,
      availableActions: p.available_actions ?? [],
    })),
    resolution: r.resolution ?? null,
    siteId: r.site_id ?? '',
    relatedEntities: r.related_entities ?? [],
  };
}

function normalizeMessage(m: RawMessage): MLClaimMessage {
  return {
    senderRole: m.sender_role,
    receiverRole: m.receiver_role,
    message: m.message,
    dateCreated: m.date_created,
    attachments: m.attachments,
  };
}

class MLClaimsError extends Error {
  constructor(
    public status: number,
    public bodyExcerpt: string,
    message?: string,
  ) {
    super(message ?? `ML claims API ${status}: ${bodyExcerpt}`);
    this.name = 'MLClaimsError';
  }
}

async function mlFetch<T>(
  url: string,
  integration: Integration,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new MLClaimsError(res.status, body.slice(0, 400));
  }
  return res.json() as Promise<T>;
}

export type ListClaimsParams = {
  status?: 'opened' | 'closed';
  limit?: number;
  offset?: number;
};

export type ListClaimsResponse = {
  data: MLClaimListItem[];
  paging: { total: number; offset: number; limit: number };
};

export async function listClaims(
  integration: Integration,
  params: ListClaimsParams = {},
): Promise<ListClaimsResponse> {
  const qs = new URLSearchParams();
  qs.set('status', params.status ?? 'opened');
  qs.set('role', 'respondent');
  qs.set('limit', String(params.limit ?? 50));
  if (params.offset) qs.set('offset', String(params.offset));

  const url = `${ML_BASE}/post-purchase/v1/claims/search?${qs.toString()}`;
  const raw = await mlFetch<{
    data: RawClaim[];
    paging: { total: number; offset: number; limit: number };
  }>(url, integration);

  return {
    data: raw.data.map(normalizeListItem),
    paging: raw.paging,
  };
}

export async function countOpenedClaims(
  integration: Integration,
): Promise<number> {
  const url = `${ML_BASE}/post-purchase/v1/claims/search?status=opened&role=respondent&limit=1`;
  const raw = await mlFetch<{ paging: { total: number } }>(url, integration);
  return raw.paging.total;
}

export async function getClaim(
  integration: Integration,
  claimId: number | string,
): Promise<MLClaimDetail> {
  const url = `${ML_BASE}/post-purchase/v1/claims/${claimId}`;
  const raw = await mlFetch<RawClaim>(url, integration);
  return normalizeDetail(raw);
}

export async function getClaimMessages(
  integration: Integration,
  claimId: number | string,
): Promise<MLClaimMessage[]> {
  const url = `${ML_BASE}/post-purchase/v1/claims/${claimId}/messages`;
  const raw = await mlFetch<RawMessage[]>(url, integration);
  // API retorna array direto (não envolve em {data:[...]})
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeMessage);
}

export async function sendClaimMessage(
  integration: Integration,
  claimId: number | string,
  message: string,
): Promise<MLClaimMessage> {
  const url = `${ML_BASE}/post-purchase/v1/claims/${claimId}/messages`;
  const raw = await mlFetch<RawMessage>(url, integration, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  return normalizeMessage(raw);
}

export { MLClaimsError };
