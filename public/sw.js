// Service Worker do agLivre.
//
// Estratégia conservadora pra SaaS financeiro:
//   - NUNCA cachear /api/* nem /admin/* (dados sensíveis e dinâmicos)
//   - Cachear apenas assets imutáveis do Next (/_next/static/*)
//   - Demais requisições: passa direto pro browser (default network)
//
// Esse é o mínimo necessário pra:
//   1. Tornar o site instalável (Chrome exige SW que escute fetch)
//   2. Servir push notifications no futuro (Sprint 2)
//   3. Acelerar segunda visita sem comprometer atualidade dos dados

const STATIC_CACHE = "aglivre-static-v1"

self.addEventListener("install", (event) => {
  // Ativa novo SW imediatamente sem esperar abas antigas fecharem
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Limpa caches antigos
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)),
        ),
      ),
      // Toma controle das abas abertas
      self.clients.claim(),
    ]),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }

  // Cross-origin: deixa o browser resolver
  if (url.origin !== self.location.origin) return

  // BLACKLIST: dados dinâmicos NUNCA passam pelo cache
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.startsWith("/sentry")
  ) {
    return
  }

  // Cache-first em assets imutáveis do Next (têm hash, seguro)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(req).then(
          (cached) =>
            cached ||
            fetch(req).then((resp) => {
              if (resp.ok) cache.put(req, resp.clone())
              return resp
            }),
        ),
      ),
    )
    return
  }

  // Resto: deixa default
})

// Handler de push notification (preparado pro Sprint 2; inerte sem subscription).
self.addEventListener("push", (event) => {
  if (!event.data) return
  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: "agLivre", body: event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "agLivre", {
      body: data.body || "",
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      data: { url: data.url || "/admin/dashboard" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) {
        existing.navigate(url)
        return existing.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
