"use client";

import { useEffect } from "react";

const CLE_LANCEMENT = "ng:lancement";

/**
 * App installée sur l'écran d'accueil (mode standalone) : iOS garde la
 * page de démarrage lue à l'installation de l'icône (/agenda pour les
 * icônes posées avant l'accueil à tuiles). Au LANCEMENT de l'app (première
 * page de la session), si elle s'ouvre sur l'agenda sans paramètre, on
 * bascule sur /accueil. Les navigations suivantes vers l'agenda, dans la
 * même session, ne sont pas touchées.
 */
export function LancementAccueil() {
  useEffect(() => {
    try {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!standalone) return;
      if (sessionStorage.getItem(CLE_LANCEMENT)) return;
      sessionStorage.setItem(CLE_LANCEMENT, "1");
      if (window.location.pathname === "/agenda" && !window.location.search) {
        window.location.replace("/accueil");
      }
    } catch {
      // Stockage indisponible : on laisse la page telle quelle.
    }
  }, []);
  return null;
}
