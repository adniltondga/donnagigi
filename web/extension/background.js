// Service worker. Centraliza fetches autenticados na API do agLivre
// pra evitar problemas de CORS nos content scripts (rodando em
// mercadolivre.com.br) e injeta content.js programaticamente — isso é
// mais confiável que declarative content_scripts em MV3 (menos gotchas
// de cache/timing quando a extensão é recarregada).

importScripts("config.js");

const ML_URL_RE = /^https:\/\/www\.mercadolivre\.com\.br\//;
const injectedTabs = new Set();

async function injectIntoTab(tabId, url) {
  if (!url || !ML_URL_RE.test(url)) return;
  if (injectedTabs.has(tabId)) return;
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["styles.css"],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    injectedTabs.add(tabId);
    console.log("[agLivre-bg] injetado em tab", tabId, url);
  } catch (err) {
    console.warn("[agLivre-bg] falhou injeção em", tabId, err?.message || err);
  }
}

// Injeta quando a aba termina de carregar (ou quando o SPA troca de URL).
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete" && tab.url) {
    injectIntoTab(tabId, tab.url);
  }
});

// Limpa o cache de abas injetadas quando a aba fecha ou recarrega.
chrome.tabs.onRemoved.addListener((tabId) => injectedTabs.delete(tabId));
chrome.webNavigation?.onCommitted?.addListener?.((details) => {
  if (details.frameId === 0) injectedTabs.delete(details.tabId);
});

// Ao instalar/atualizar a extensão, injeta em abas do ML já abertas.
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: "https://www.mercadolivre.com.br/*" });
  for (const t of tabs) if (t.id) injectIntoTab(t.id, t.url || "");
});
chrome.runtime.onStartup.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: "https://www.mercadolivre.com.br/*" });
  for (const t of tabs) if (t.id) injectIntoTab(t.id, t.url || "");
});

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
      return saveCost(msg.payload || {
        mlListingId: msg.mlListingId,
        productCost: msg.productCost,
        title: msg.title,
      });
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
  if (!Array.isArray(listingIds) || listingIds.length === 0) {
    return { costs: {}, variantCosts: {}, variations: {} };
  }
  return authedFetch("/api/extension/costs", {
    method: "POST",
    body: JSON.stringify({ listingIds }),
  });
}

async function saveCost(payload) {
  // payload pode ser { mlListingId, productCost, title } (legacy)
  // ou { mlListingId, variationId, variationName, productCost, title } (novo)
  return authedFetch("/api/extension/costs", {
    method: "PUT",
    body: JSON.stringify({ aplicarRetroativo: true, ...payload }),
  });
}
