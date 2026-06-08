"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker /sw.js au premier chargement de l'app.
 * Le SW est un no-op fonctionnel : sa présence suffit à rendre l'app
 * installable comme PWA sur iPhone et Android.
 *
 * Composant à monter une seule fois dans le layout racine.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Localhost : on évite d'enregistrer pour ne pas polluer le dev.
    if (window.location.hostname === "localhost") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // Pas critique — silencieux pour ne pas spammer la console.
      });
  }, []);

  return null;
}
