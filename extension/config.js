// Endpoints do agLivre. O popup deixa trocar em runtime (salvo em storage).
const DEFAULT_API_BASE = "https://aglivre.dgadigital.com.br";

async function getApiBase() {
  const { apiBase } = await chrome.storage.local.get(["apiBase"]);
  return apiBase || DEFAULT_API_BASE;
}

async function setApiBase(base) {
  await chrome.storage.local.set({ apiBase: base });
}

async function getToken() {
  const { token } = await chrome.storage.local.get(["token"]);
  return token || null;
}

async function setAuth(token, user, tenant) {
  await chrome.storage.local.set({ token, user, tenant });
}

async function clearAuth() {
  await chrome.storage.local.remove(["token", "user", "tenant"]);
}
