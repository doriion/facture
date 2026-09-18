"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Le contenu défile dans <main> (pas dans la fenêtre) : Next.js ne
 * restaure donc pas la position au retour arrière, et pire, une page
 * neuve s'ouvrait à la position où l'on avait laissé la précédente.
 *
 * Ici : la position de chaque écran est mémorisée (sessionStorage,
 * par chemin) ; en revenant dessus on la retrouve, un nouvel écran
 * s'ouvre en haut. Quelques tentatives espacées, le contenu pouvant
 * arriver après le squelette de chargement. La clé inclut la query
 * (?date=, ?statut=…) : deux écrans d'une même route sont distincts.
 */
const PREFIXE = "defilement:";

export function RestaurationDefilement() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const cle = PREFIXE + pathname + (search ? `?${search}` : "");

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    let cible = 0;
    try {
      cible = Number(sessionStorage.getItem(cle) ?? 0) || 0;
    } catch {
      /* stockage indisponible : on part du haut */
    }
    const minuteries: number[] = [];
    const appliquer = () => {
      if (cible <= 0) {
        main.scrollTop = 0;
        return;
      }
      if (main.scrollHeight - main.clientHeight >= cible) main.scrollTop = cible;
    };
    appliquer();
    for (const delai of [50, 200, 500]) {
      minuteries.push(window.setTimeout(appliquer, delai));
    }

    let enAttente = 0;
    const surDefilement = () => {
      if (enAttente) return;
      enAttente = window.setTimeout(() => {
        enAttente = 0;
        try {
          sessionStorage.setItem(cle, String(Math.round(main.scrollTop)));
        } catch {
          /* ignoré */
        }
      }, 150);
    };
    main.addEventListener("scroll", surDefilement, { passive: true });
    return () => {
      minuteries.forEach((m) => window.clearTimeout(m));
      if (enAttente) window.clearTimeout(enAttente);
      main.removeEventListener("scroll", surDefilement);
    };
  }, [cle]);

  return null;
}
