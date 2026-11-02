"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Compagnon de l'ouverture immédiate (public/sw.js) : la page affichée
 * vient du cache de l'appareil ; quand le service worker a reçu la
 * version fraîche, on recharge les données sur place (router.refresh,
 * sans clignotement). Un fin trait animé en haut signale la mise à
 * jour en cours. Session expirée côté serveur : retour à la connexion.
 */
export function RafraichissementPage() {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    // Page servie par le service worker depuis le cache : la navigation
    // n'a rien transféré du réseau.
    try {
      const nav = performance.getEntriesByType("navigation")[0] as (PerformanceEntry & { transferSize?: number }) | undefined;
      if (navigator.serviceWorker.controller && nav && nav.transferSize === 0) setEnCours(true);
    } catch {
      // Mesure indisponible : pas de trait, le rafraîchissement a lieu quand même.
    }
    const message = (e: MessageEvent) => {
      const data = e.data as { type?: string; echec?: boolean } | null;
      if (data?.type === "PAGE_RAFRAICHIE") {
        setEnCours(false);
        if (!data.echec) router.refresh();
      } else if (data?.type === "SESSION_EXPIREE") {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
      } else if (data?.type === "PAGE_PERIMEE") {
        setEnCours(false);
      }
    };
    navigator.serviceWorker.addEventListener("message", message);
    // Sécurité : jamais de trait éternel (serveur muet, message perdu).
    const t = setTimeout(() => setEnCours(false), 15000);
    return () => {
      navigator.serviceWorker.removeEventListener("message", message);
      clearTimeout(t);
    };
  }, [router]);

  if (!enCours) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 h-0.5 overflow-hidden bg-primary/15">
      <div className="h-full w-1/3 animate-[glisser_1.1s_ease-in-out_infinite] bg-primary" />
    </div>
  );
}
