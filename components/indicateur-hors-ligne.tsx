"use client";

import { useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

/**
 * Bandeau discret quand le téléphone n'a plus de réseau : les pages
 * déjà ouvertes (et les écrans préchauffés) restent lisibles grâce au
 * service worker, mais rien ne s'enregistre. Au retour du réseau, on
 * propose d'actualiser pour revoir des données fraîches.
 */
function formatDateCopie(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function IndicateurHorsLigne() {
  const [horsLigne, setHorsLigne] = useState(false);
  const [revenu, setRevenu] = useState(false);
  /** Page servie depuis le cache par le service worker (réseau trop lent) : date de la copie. */
  const [perimee, setPerimee] = useState<string | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setHorsLigne(navigator.onLine === false);
    const perdu = () => {
      setHorsLigne(true);
      setRevenu(false);
    };
    const retrouve = () => {
      setHorsLigne(false);
      setRevenu(true);
    };
    const message = (e: MessageEvent) => {
      const data = e.data as { type?: string; date?: string } | null;
      if (data?.type === "PAGE_PERIMEE") setPerimee(data.date ?? "");
    };
    window.addEventListener("offline", perdu);
    window.addEventListener("online", retrouve);
    navigator.serviceWorker?.addEventListener("message", message);
    return () => {
      window.removeEventListener("offline", perdu);
      window.removeEventListener("online", retrouve);
      navigator.serviceWorker?.removeEventListener("message", message);
    };
  }, []);

  if (horsLigne) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 sm:px-6"
      >
        <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Hors ligne : vous voyez les données du dernier passage. Les
          modifications ne partiront pas tant que le réseau ne revient pas.
        </span>
      </div>
    );
  }
  if (perimee !== null) {
    const quand = formatDateCopie(perimee);
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 sm:px-6"
      >
        <span>
          Réseau trop lent : vous voyez la dernière version connue de cette page
          {quand ? ` (${quand})` : ""}.
        </span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1 font-medium underline"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Actualiser
        </button>
      </div>
    );
  }
  if (revenu) {
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-2 border-b border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 sm:px-6"
      >
        <span>Réseau retrouvé.</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1 font-medium underline"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Actualiser
        </button>
      </div>
    );
  }
  return null;
}
