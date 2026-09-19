"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Enregistre le service worker /sw.js au premier chargement de l'app
 * et gère sa MISE À JOUR : quand un nouveau SW est installé alors
 * qu'un ancien contrôle la page, on propose « Nouvelle version —
 * Recharger ». Au clic, le nouveau SW prend la main (SKIP_WAITING) et
 * la page se recharge : plus d'onglet figé sur d'anciens scripts après
 * un déploiement (PWA laissée ouverte des jours sur l'iPhone).
 *
 * Composant à monter une seule fois dans le layout racine.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Localhost : on évite d'enregistrer pour ne pas polluer le dev.
    if (window.location.hostname === "localhost") return;

    let rechargementDemande = false;
    const proposer = (attente: ServiceWorker) => {
      toast("Nouvelle version disponible", {
        description: "Rechargez pour l'utiliser.",
        duration: Infinity,
        action: {
          label: "Recharger",
          onClick: () => {
            rechargementDemande = true;
            attente.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) proposer(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const nouveau = reg.installing;
          if (!nouveau) return;
          nouveau.addEventListener("statechange", () => {
            if (nouveau.state === "installed" && navigator.serviceWorker.controller) {
              proposer(nouveau);
            }
          });
        });
        // Vérifie une mise à jour quand l'app revient au premier plan.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        });
      })
      .catch(() => {
        // Pas critique — silencieux pour ne pas spammer la console.
      });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (rechargementDemande) window.location.reload();
    });
  }, []);

  return null;
}
