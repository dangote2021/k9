// =====================================================================
// K9 — service-worker.js  (PWA offline + Web Push)
// =====================================================================
// Stratégie :
//   - HTML / shell : stale-while-revalidate (l'app reste dispo offline,
//     mais update silencieusement quand le réseau revient)
//   - Assets statiques (branding, icons) : cache-first
//   - API : network-first avec fallback cache (durée courte)
//   - PUSH : afficher la notification
//   - Notification click : ouvrir/focus l'app sur l'URL demandée
// =====================================================================

const VERSION = "v4.6";
const CACHE_SHELL = "k9-shell-" + VERSION;
const CACHE_ASSETS = "k9-assets-" + VERSION;
const CACHE_API = "k9-api-" + VERSION;

// Shell : pages essentielles à pré-cacher
const SHELL_URLS = [
  "/",
  "/landing",
  "/manifest.json",
  "/branding/favicon.ico",
  "/branding/logo-paw-only.svg",
  "/branding/apple-touch-icon.png",
  "/branding/app-icon-192.png",
  "/branding/app-icon-512.png",
  "/404.html",
];

// ---- Install : pre-cache shell ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((cache) =>
      cache.addAll(SHELL_URLS).catch((e) => {
        // tolérant : si une URL n'est pas dispo, on continue sans planter
        console.warn("[sw] precache partial", e);
      })
    )
  );
  self.skipWaiting();
});

// ---- Activate : nettoyer les vieux caches ----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch : routing par type ----
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Skip cross-origin (Supabase, Anthropic, etc.) — laisser le réseau gérer
  if (url.origin !== self.location.origin) return;

  // API : network-first, fallback cache (5 min)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req, CACHE_API, 5 * 60));
    return;
  }

  // Branding / assets : cache-first
  if (url.pathname.startsWith("/branding/") ||
      /\.(?:png|jpg|jpeg|svg|ico|woff2?|webp)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req, CACHE_ASSETS));
    return;
  }

  // HTML / pages : stale-while-revalidate
  if (req.mode === "navigate" ||
      req.headers.get("accept")?.includes("text/html") ||
      url.pathname === "/" ||
      url.pathname.endsWith(".html")) {
    event.respondWith(staleWhileRevalidate(req, CACHE_SHELL));
    return;
  }

  // Défaut : SWR
  event.respondWith(staleWhileRevalidate(req, CACHE_SHELL));
});

// ---- Stratégies de cache ----

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then((res) => {
    if (res && res.ok && res.type === "basic") {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => null);

  // Renvoie le cache immédiatement, fallback réseau si pas en cache
  if (cached) {
    networkPromise; // fire & forget pour mettre à jour
    return cached;
  }
  const fresh = await networkPromise;
  if (fresh) return fresh;
  // Offline + pas en cache → fallback /404 ou /
  if (req.mode === "navigate") {
    return (await cache.match("/")) || (await cache.match("/404.html")) || Response.error();
  }
  return Response.error();
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    return Response.error();
  }
}

async function networkFirst(req, cacheName, maxAgeSec) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      // Stocke avec un timestamp léger pour expiration
      const headers = new Headers(res.headers);
      headers.set("x-k9-cached-at", String(Date.now()));
      const body = await res.clone().arrayBuffer();
      cache.put(req, new Response(body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      })).catch(() => {});
    }
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) {
      // Vérifie l'expiration soft
      const cachedAt = parseInt(cached.headers.get("x-k9-cached-at") || "0", 10);
      if (Date.now() - cachedAt < maxAgeSec * 1000) return cached;
      return cached; // tolérant : si offline, mieux qu'une erreur
    }
    return Response.error();
  }
}

// ---- Push notifications ----

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { title: "K9", body: event.data?.text() || "Nouveau rappel" }; }

  const title = payload.title || "🐶 K9";
  const options = {
    body: payload.body || "",
    icon: "/branding/app-icon-192.png",
    badge: "/branding/favicon-32.png",
    data: { url: payload.url || "/" },
    tag: payload.tag || "k9-reminder",
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate?.(targetUrl);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ---- Message channel : permet à l'app de demander un skipWaiting ----
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
