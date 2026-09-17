/**
 * Service Worker de NG Gestion.
 *
 * - /_next/static/* (fichiers hachés, immuables) : cache d'abord — une
 *   réouverture depuis l'écran d'accueil ne retélécharge pas les scripts.
 * - Icônes et manifest : cache d'abord, rafraîchi en arrière-plan.
 * - Navigations (pages) : réseau d'abord ; sans réseau, la page
 *   /hors-ligne mise en cache à l'installation. Les pages elles-mêmes ne
 *   sont jamais servies depuis le cache (données personnelles, session).
 * - Tout le reste (API, actions serveur, Supabase) : réseau, sans cache.
 *
 * Rappels push : l'évènement `push` affiche la notification envoyée par
 * /api/cron/rappels-push ; un tap dessus ouvre (ou ramène) l'app sur le
 * jour du rendez-vous.
 *
 * Changer VERSION invalide les anciens caches à l'activation.
 */

const VERSION = "v3";
const CACHE_STATIQUE = `ng-statique-${VERSION}`;
const CACHE_PAGES = `ng-pages-${VERSION}`;
const PAGE_HORS_LIGNE = "/hors-ligne";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_PAGES)
      .then((cache) => cache.add(PAGE_HORS_LIGNE))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) =>
        Promise.all(
          cles
            .filter((c) => c.startsWith("ng-") && !c.endsWith(VERSION))
            .map((c) => caches.delete(c)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Fichiers hachés : cache d'abord.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheDAbord(req, CACHE_STATIQUE));
    return;
  }
  // Icônes, manifest, favicon : cache d'abord, mise à jour en arrière-plan.
  if (
    url.pathname.startsWith("/icones/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/favicon.ico"
  ) {
    event.respondWith(cachePuisReseau(req, CACHE_STATIQUE));
    return;
  }
  // Pages : réseau d'abord, page hors-ligne en secours.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(CACHE_PAGES);
        return (await cache.match(PAGE_HORS_LIGNE)) || Response.error();
      }),
    );
  }
  // Le reste passe par le réseau, sans interception.
});

async function cacheDAbord(req, nomCache) {
  const cache = await caches.open(nomCache);
  const enCache = await cache.match(req);
  if (enCache) return enCache;
  const reponse = await fetch(req);
  if (reponse.ok) cache.put(req, reponse.clone());
  return reponse;
}

async function cachePuisReseau(req, nomCache) {
  const cache = await caches.open(nomCache);
  const enCache = await cache.match(req);
  const rafraichir = fetch(req)
    .then((reponse) => {
      if (reponse.ok) cache.put(req, reponse.clone());
      return reponse;
    })
    .catch(() => enCache);
  return enCache || rafraichir;
}

// ---------------------------------------------------------------------------
// Rappels push
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let contenu = { titre: "NG Gestion", corps: "", url: "/agenda", tag: undefined };
  try {
    if (event.data) contenu = { ...contenu, ...event.data.json() };
  } catch {
    if (event.data) contenu.corps = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(contenu.titre, {
      body: contenu.corps,
      icon: "/icones/vague-192.png",
      badge: "/icones/vague-192.png",
      tag: contenu.tag,
      renotify: Boolean(contenu.tag),
      data: { url: contenu.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/agenda", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if ("focus" in f) {
          if ("navigate" in f) f.navigate(url).catch(() => {});
          return f.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
