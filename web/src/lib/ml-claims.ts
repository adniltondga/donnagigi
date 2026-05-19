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

/** O que o comprador pediu como resolução. */
export type MLClaimExpectedResolution = {
  playerRole: string;
  /** return_product | refund | change_product | etc. */
  expectedResolution: string;
  status: string; // pending | accepted | etc
  dateCreated: string;
  lastUpdated: string;
};

export type MLClaimReturnShipment = {
  id: number;
  /** shipped | delivered | to_be_agreed | cancelled | etc. */
  status: string;
  trackingNumber: string | null;
  destinationName: string | null;
  destinationCity: string | null;
  destinationState: string | null;
};

export type MLClaimReturn = {
  id: number;
  /** Status agregado do return (geralmente bate com shipments[0].status). */
  status: string;
  /** retained | released | refunded | etc. — sinaliza o dinheiro. */
  statusMoney: string;
  /** delivered = ML estorna quando o produto chegar no vendedor. */
  refundAt: string | null;
  /** return_total | return_partial. */
  subtype: string;
  dateCreated: string;
  dateClosed: string | null;
  shipments: MLClaimReturnShipment[];
  orders: Array<{
    orderId: number;
    itemId: string | null;
    returnQuantity: string;
  }>;
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

/** Item enriquecido com sinal de "bola na mão de quem". */
export type MLClaimListItemEnriched = MLClaimListItem & {
  /** Quem mandou a última mensagem da thread, ou null se sem mensagens. */
  lastMessageRole: string | null;
  lastMessageAt: string | null;
  /**
   * true quando a última mensagem NÃO foi do seller (respondent). Cobre
   * tanto "comprador respondeu" quanto "ML te chamou" quanto "thread vazia".
   */
  needsResponse: boolean;
};

export type ListClaimsResponse<T extends MLClaimListItem = MLClaimListItem> = {
  data: T[];
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

/**
 * Pega a thread de mensagens e devolve só o que precisamos pra sinalizar
 * "aguardando você". Falha silenciosa: se uma mensagem específica não
 * vier (claim recém aberta, rate limit, etc), retorna campos null em
 * vez de derrubar a lista inteira.
 */
async function fetchLastMessageInfo(
  integration: Integration,
  claimId: number,
): Promise<{ role: string | null; at: string | null }> {
  try {
    const msgs = await getClaimMessages(integration, claimId);
    if (msgs.length === 0) return { role: null, at: null };
    const last = msgs[msgs.length - 1];
    return { role: last.senderRole, at: last.dateCreated ?? null };
  } catch {
    return { role: null, at: null };
  }
}

/**
 * Lista claims abertas e enriquece cada item com info da última mensagem.
 * Faz N+1 requests (paralelo). Pra N≤50 isso é aceitável (~1-2s); pra
 * N maior considerar cache em memória ou webhook do tópico `claims`.
 */
export async function listClaimsEnriched(
  integration: Integration,
  params: ListClaimsParams = {},
): Promise<ListClaimsResponse<MLClaimListItemEnriched>> {
  const base = await listClaims(integration, params);
  const enriched = await Promise.all(
    base.data.map(async (c) => {
      const last = await fetchLastMessageInfo(integration, c.id);
      const needsResponse = !last.role || last.role !== 'respondent';
      return {
        ...c,
        lastMessageRole: last.role,
        lastMessageAt: last.at,
        needsResponse,
      } satisfies MLClaimListItemEnriched;
    }),
  );
  return { data: enriched, paging: base.paging };
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

type RawExpectedResolution = {
  player_role: string;
  expected_resolution: string;
  status: string;
  date_created: string;
  last_updated: string;
};

export async function getClaimExpectedResolutions(
  integration: Integration,
  claimId: number | string,
): Promise<MLClaimExpectedResolution[]> {
  try {
    const url = `${ML_BASE}/post-purchase/v1/claims/${claimId}/expected-resolutions`;
    const raw = await mlFetch<RawExpectedResolution[]>(url, integration);
    if (!Array.isArray(raw)) return [];
    return raw.map((r) => ({
      playerRole: r.player_role,
      expectedResolution: r.expected_resolution,
      status: r.status,
      dateCreated: r.date_created,
      lastUpdated: r.last_updated,
    }));
  } catch {
    return [];
  }
}

type RawReturnShipment = {
  shipment_id: number;
  status: string;
  tracking_number?: string | null;
  destination?: {
    name?: string | null;
    shipping_address?: {
      city?: { name?: string | null } | null;
      state?: { name?: string | null } | null;
    } | null;
  } | null;
};

type RawReturn = {
  id: number;
  status: string;
  status_money: string;
  refund_at: string | null;
  subtype: string;
  date_created: string;
  date_closed: string | null;
  shipments?: RawReturnShipment[];
  orders?: Array<{
    order_id: number;
    item_id?: string | null;
    return_quantity?: string;
  }>;
};

/**
 * Pra um subset das claims (geralmente as que já viraram return formal),
 * o ML cria um recurso em /post-purchase/v2/claims/{id}/returns. Quando
 * a claim ainda está só em dispute sem return formalizado, esse endpoint
 * dá 404 — tratamos como `null` em vez de erro.
 */
export async function getClaimReturn(
  integration: Integration,
  claimId: number | string,
): Promise<MLClaimReturn | null> {
  try {
    const url = `${ML_BASE}/post-purchase/v2/claims/${claimId}/returns`;
    const raw = await mlFetch<RawReturn>(url, integration);
    return {
      id: raw.id,
      status: raw.status,
      statusMoney: raw.status_money,
      refundAt: raw.refund_at,
      subtype: raw.subtype,
      dateCreated: raw.date_created,
      dateClosed: raw.date_closed,
      shipments: (raw.shipments ?? []).map((s) => ({
        id: s.shipment_id,
        status: s.status,
        trackingNumber: s.tracking_number ?? null,
        destinationName: s.destination?.name ?? null,
        destinationCity: s.destination?.shipping_address?.city?.name ?? null,
        destinationState:
          s.destination?.shipping_address?.state?.name ?? null,
      })),
      orders: (raw.orders ?? []).map((o) => ({
        orderId: o.order_id,
        itemId: o.item_id ?? null,
        returnQuantity: o.return_quantity ?? '0',
      })),
    };
  } catch (err) {
    if (err instanceof MLClaimsError && (err.status === 404 || err.status === 400)) {
      return null;
    }
    throw err;
  }
}

/**
 * Lista evidências (fotos, comprovantes) anexadas à claim. Vazio quando
 * ninguém anexou nada ainda.
 */
export async function getClaimEvidences(
  integration: Integration,
  claimId: number | string,
): Promise<unknown[]> {
  try {
    const url = `${ML_BASE}/post-purchase/v1/claims/${claimId}/evidences`;
    const raw = await mlFetch<unknown[]>(url, integration);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
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
