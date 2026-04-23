// Service worker. Centraliza fetches autenticados na API do agLivre
// pra evitar problemas de CORS nos content scripts (rodando em
// mercadolivre.com.br).

importScripts("config.js");

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handle(msg)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
  return true; // async
});

async function handle(msg) {
  switch (msg?.type) {
    case "login":
      return login(msg.email, msg.password);
    case "logout":
      await clearAuth();
      return { ok: true };
    case "status":
      return status();
    case "fetchCosts":
      return fetchCosts(msg.listingIds || []);
    case "saveCost":
      return saveCost(msg.mlListingId, msg.productCost, msg.title);
    case "setApiBase":
      await setApiBase(msg.apiBase);
      return { ok: true };
    default:
      throw new Error("Mensagem desconhecida: " + msg?.type);
  }
}

async function login(email, password) {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/extension/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  await setAuth(json.token, json.user, json.tenant);
  return { user: json.user, tenant: json.tenant };
}

async function status() {
  const { token, user, tenant, apiBase } = await chrome.storage.local.get([
    "token",
    "user",
    "tenant",
    "apiBase",
  ]);
  return {
    authenticated: !!token,
    user: user || null,
    tenant: tenant || null,
    apiBase: apiBase || DEFAULT_API_BASE,
  };
}

async function authedFetch(path, init = {}) {
  const base = await getApiBase();
  const token = await getToken();
  if (!token) throw new Error("NOT_AUTHENTICATED");

  const headers = Object.assign({}, init.headers || {}, {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });
  const res = await fetch(`${base}${path}`, { ...init, headers });

  if (res.status === 401) {
    await clearAuth();
    throw new Error("NOT_AUTHENTICATED");
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

async function fetchCosts(listingIds) {
  if (!Array.isArray(listingIds) || listingIds.length === 0) return { costs: {} };
  return authedFetch("/api/extension/costs", {
    method: "POST",
    body: JSON.stringify({ listingIds }),
  });
}

async function saveCost(mlListingId, productCost, title) {
  return authedFetch("/api/extension/costs", {
    method: "PUT",
    body: JSON.stringify({ mlListingId, productCost, title, aplicarRetroativo: true }),
  });
}
