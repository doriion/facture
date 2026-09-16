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
 * Changer VERSION invalide les anciens caches à l'activation.
 */

const VERSION = "v2";
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
