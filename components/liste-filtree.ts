"use client";

import { useEffect, useState } from "react";

import { parametresFiltres } from "@/lib/filtres-listes";

/**
 * État des filtres d'une liste, initialisé depuis l'URL (liens profonds)
 * et recopié dans l'URL sans navigation (replaceState) : le filtrage se
 * fait sur place, le serveur n'est pas sollicité.
 */
export function useFiltresListe<T extends Record<string, string>>(chemin: string, initial: T) {
  const [filtres, setFiltres] = useState<T>(initial);
  useEffect(() => {
    window.history.replaceState(null, "", `${chemin}${parametresFiltres(filtres)}`);
  }, [chemin, filtres]);
  return [filtres, setFiltres] as const;
}
