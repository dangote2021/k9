// =====================================================================
// K9 — service-worker.js  (PWA + Web Push)
// =====================================================================
// Minimal : on ne cache quasi rien (l'app est un seul HTML et Vercel CDN
// gère très bien le cache). On se concentre sur :
//   1. Event 'push'    → afficher la notification
//   2. Event 'notificationclick' → ouvrir/focus l'app sur l'URL demandée
//   3. Event 'install' / 'activate' → skip waiting / claim clients
// =====================================================================

const CACHE = "k9-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { title: "K9", body: event.data?.text() || "Nouveau rappel" }; }

  const title = payload.title || "🐶 K9";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
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
