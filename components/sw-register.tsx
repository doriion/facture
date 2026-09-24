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
 * Après enregistrement, demande le PRÉCHAUFFAGE des écrans principaux
 * (mis en cache en tâche de fond pour être lisibles hors ligne) — une
 * fois par session de navigateur, quand la page est au repos.
 *
 * Composant à monter une seule fois dans le layout racine.
 */
const CLE_PRECHAUFFE = "ng:prechauffe";

/** Vide les pages gardées pour le hors ligne (appelé à la déconnexion). */
export function viderCachePages(): void {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "VIDER_PAGES" });
    sessionStorage.removeItem(CLE_PRECHAUFFE);
  } catch {
    // Sans service worker (navigation privée), rien à vider.
  }
}

function demanderPrechauffage(): void {
  try {
    if (sessionStorage.getItem(CLE_PRECHAUFFE)) return;
    // Pas de préchauffage depuis la connexion ou les pages publiques.
    if (/^\/(login|c|hors-ligne)(\/|$)/.test(window.location.pathname)) return;
    const lancer = () => {
      navigator.serviceWorker.controller?.postMessage({ type: "PRECHAUFFER" });
      sessionStorage.setItem(CLE_PRECHAUFFE, "1");
    };
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void;
      setTimeout: (cb: () => void, ms: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(lancer, { timeout: 8000 });
    } else {
      w.setTimeout(lancer, 3000);
    }
  } catch {
    // sessionStorage indisponible : on n'insiste pas.
  }
}

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
        // Écrans principaux en cache d'avance (lisibles hors ligne).
        if (navigator.serviceWorker.controller) demanderPrechauffage();
      })
      .catch(() => {
        // Pas critique — silencieux pour ne pas spammer la console.
      });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (rechargementDemande) window.location.reload();
      else demanderPrechauffage();
    });
  }, []);

  return null;
}
