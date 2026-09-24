/**
 * Service Worker de NG Gestion.
 *
 * Objectif : ouvrir l'app en un instant sur le téléphone et rester
 * consultable sans réseau (sous-sol, cave, zone blanche).
 *
 * - /_next/static/* (fichiers hachés, immuables) : cache d'abord.
 * - Icônes, manifest, favicon : cache d'abord, rafraîchi en arrière-plan.
 * - Pages (navigations) : RÉSEAU D'ABORD avec un délai plafonné ; si le
 *   réseau est absent ou trop lent, la dernière version de la MÊME page
 *   est servie depuis le cache (données du dernier passage), sinon la
 *   page /hors-ligne. Chaque page reçue du réseau est mise en cache.
 *   Les pages sont donc conservées sur l'appareil : le cache est vidé à
 *   la déconnexion (message VIDER_PAGES) et à chaque nouvelle version.
 * - Préchauffage : après connexion, la page envoie PRECHAUFFER et les
 *   écrans principaux sont mis en cache en tâche de fond, pour être
 *   lisibles hors ligne même sans les avoir ouverts.
 * - API, actions serveur (POST), Supabase, PDF : réseau, sans cache.
 *
 * Rappels push : l'évènement `push` affiche la notification envoyée par
 * /api/cron/rappels-push ; un tap dessus ouvre (ou ramène) l'app sur le
 * jour du rendez-vous.
 *
 * Changer VERSION invalide les anciens caches à l'activation.
 *
 * Mise à jour : le nouveau SW ATTEND (pas de skipWaiting automatique) ;
 * la page propose « Nouvelle version — recharger » et lui envoie
 * SKIP_WAITING. Sans ça, un onglet ouvert gardait ses anciens scripts
 * avec le nouveau SW : les chunks de l'ancien build n'existaient plus
 * et « Planifier » ne s'ouvrait plus.
 */

const VERSION = "v5";
const CACHE_STATIQUE = `ng-statique-${VERSION}`;
const CACHE_PAGES = `ng-pages-${VERSION}`;
const CACHE_PHOTOS = `ng-photos-${VERSION}`;
/** Photos conservées pour le hors ligne (les plus anciennes sont évincées). */
const MAX_PHOTOS = 300;
const PAGE_HORS_LIGNE = "/hors-ligne";

/** Au-delà, on sert la copie en cache (réseau mobile qui rame). */
const DELAI_RESEAU_MS = 4000;
/** Écrans mis en cache d'avance après connexion. */
const PAGES_A_PRECHAUFFER = [
  "/agenda",
  "/taches",
  "/factures",
  "/devis",
  "/clients",
  "/interventions",
  "/maintenance",
  "/dashboard",
];
/** Pages jamais gardées en cache (sans intérêt hors ligne, ou sensibles). */
const PAGES_SANS_CACHE = ["/login", "/exports", "/parametres"];
/** Nombre maximal de pages conservées (les plus anciennes sont évincées). */
const MAX_PAGES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(precacherPage(PAGE_HORS_LIGNE).catch(() => {}));
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  if (data.type === "VIDER_PAGES") {
    event.waitUntil(
      caches
        .delete(CACHE_PAGES)
        .then(() => precacherPage(PAGE_HORS_LIGNE))
        .catch(() => {}),
    );
  }
  if (data.type === "PRECHAUFFER") {
    event.waitUntil(prechauffer());
  }
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
      // La page hors-ligne est re-mise en cache à chaque activation :
      // celle du build précédent référençait des scripts disparus.
      .then(() => precacherPage(PAGE_HORS_LIGNE).catch(() => {}))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Photos et signatures (URL signées du Storage Supabase) : cache
  // d'abord, clé SANS le jeton (il change à chaque affichage) — les
  // photos d'intervention et de tâches restent visibles sans réseau.
  if (
    url.origin !== self.location.origin &&
    url.hostname.endsWith(".supabase.co") &&
    url.pathname.includes("/storage/v1/object/sign/")
  ) {
    event.respondWith(photoCacheDAbord(req, url));
    return;
  }
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
  // Pages : réseau d'abord (délai plafonné), copie en cache en secours.
  if (req.mode === "navigate") {
    event.respondWith(pageReseauPuisCache(req));
  }
  // Le reste (API, PDF, RSC, Supabase) passe par le réseau, sans interception.
});

function pageCachable(url) {
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/c/")) return false;
  return !PAGES_SANS_CACHE.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"));
}

async function pageReseauPuisCache(req) {
  const url = new URL(req.url);
  const cachable = pageCachable(url);
  const cache = await caches.open(CACHE_PAGES);
  // Clé sans paramètres de navigation Next (ex. ?_rsc=) — mais on garde
  // les vrais paramètres (date de l'agenda, filtres) : ce sont des pages
  // différentes.
  const cle = cleDePage(url);

  try {
    const reponse = await avecDelai(fetch(req), DELAI_RESEAU_MS);
    // Une réponse redirigée (session expirée → /login) ne doit pas être
    // conservée sous la clé de l'écran demandé.
    const versLogin = reponse.redirected || new URL(reponse.url || cle).pathname.startsWith("/login");
    if (reponse && reponse.ok && cachable && reponse.type === "basic" && !versLogin) {
      cache.put(cle, reponse.clone()).then(() => limiterPages(cache)).catch(() => {});
    }
    return reponse;
  } catch {
    if (cachable) {
      const enCache = await cache.match(cle);
      if (enCache) return enCache;
    }
    return (await cache.match(PAGE_HORS_LIGNE)) || Response.error();
  }
}

function cleDePage(url) {
  const u = new URL(url.href);
  u.searchParams.delete("_rsc");
  return u.href;
}

function avecDelai(promesse, ms) {
  return new Promise((resoudre, rejeter) => {
    const t = setTimeout(() => rejeter(new Error("délai réseau dépassé")), ms);
    promesse.then(
      (v) => {
        clearTimeout(t);
        resoudre(v);
      },
      (e) => {
        clearTimeout(t);
        rejeter(e);
      },
    );
  });
}

async function limiterPages(cache) {
  const cles = await cache.keys();
  if (cles.length <= MAX_PAGES) return;
  // Les entrées sont dans l'ordre d'insertion : on retire les plus anciennes.
  const aSupprimer = cles.slice(0, cles.length - MAX_PAGES);
  await Promise.all(
    aSupprimer
      .filter((r) => new URL(r.url).pathname !== PAGE_HORS_LIGNE)
      .map((r) => cache.delete(r)),
  );
}

async function prechauffer() {
  for (const chemin of PAGES_A_PRECHAUFFER) {
    try {
      await precacherPage(chemin);
    } catch {
      // Sans réseau, on réessaiera à la prochaine ouverture.
    }
  }
}

/**
 * Met une page en cache AVEC les scripts et feuilles de style qu'elle
 * référence (/_next/static/…) : une page servie hors ligne sans ses
 * chunks tombait sur « Une erreur est survenue » (ChunkLoadError).
 * Une redirection vers /login (session absente) n'est pas gardée.
 */
async function precacherPage(chemin) {
  const reponse = await fetch(chemin, { credentials: "same-origin", redirect: "follow" });
  if (!reponse.ok || reponse.type !== "basic") return;
  if (reponse.redirected || new URL(reponse.url).pathname.startsWith("/login")) return;
  const html = await reponse.clone().text();
  const pages = await caches.open(CACHE_PAGES);
  await pages.put(new URL(chemin, self.location.origin).href, reponse);
  await precacherRessources(html);
}

async function precacherRessources(html) {
  const statique = await caches.open(CACHE_STATIQUE);
  const urls = new Set();
  const re = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) urls.add(m[1].replace(/&amp;/g, "&"));
  await Promise.all(
    Array.from(urls).map(async (u) => {
      if (await statique.match(u)) return;
      try {
        const r = await fetch(u);
        if (r.ok) await statique.put(u, r);
      } catch {
        // Ressource manquante : la page restera dégradée hors ligne.
      }
    }),
  );
}

async function photoCacheDAbord(req, url) {
  const cache = await caches.open(CACHE_PHOTOS);
  const cle = url.origin + url.pathname;
  const enCache = await cache.match(cle);
  if (enCache) return enCache;
  const reponse = await fetch(req);
  // Réponse opaque (no-cors) ou normale : on la garde telle quelle.
  if (reponse.ok || reponse.type === "opaque") {
    cache.put(cle, reponse.clone()).then(() => limiterCache(cache, MAX_PHOTOS)).catch(() => {});
  }
  return reponse;
}

async function limiterCache(cache, max) {
  const cles = await cache.keys();
  if (cles.length <= max) return;
  await Promise.all(cles.slice(0, cles.length - max).map((r) => cache.delete(r)));
}

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
