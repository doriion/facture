/**
 * Service Worker minimaliste pour Facture AE.
 *
 * But premier : satisfaire les critères PWA d'installabilité
 * (Chrome / Safari iOS demandent qu'un SW soit enregistré pour
 * proposer « Ajouter à l'écran d'accueil »).
 *
 * Comportement : on n'intercepte PAS les requêtes (pas de cache offline),
 * l'app reste « online-only ». Si on veut de l'offline un jour, ajouter
 * une stratégie cache-first sur les routes statiques /_next/static/*.
 */

self.addEventListener("install", (event) => {
  // Activation immédiate du nouveau SW sur le prochain reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Prend le contrôle des onglets ouverts immédiatement.
  event.waitUntil(self.clients.claim());
});

// Pas de listener `fetch` : on laisse le réseau gérer.
// L'installabilité est conditionnée à la présence d'un listener fetch
// par certains navigateurs (notamment Chrome). On en met donc un
// transparent qui ne fait rien.
self.addEventListener("fetch", (_event) => {
  // No-op intentionnel — toutes les requêtes passent par le réseau.
});
