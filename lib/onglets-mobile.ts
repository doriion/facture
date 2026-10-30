/**
 * Onglets de la barre du bas (téléphone) — logique PURE, testée.
 * Quatre écrans au choix parmi la navigation, mémorisés sur l'appareil
 * (localStorage) : la barre est propre à chaque téléphone.
 */

import { NAV_ITEMS } from "@/lib/constants";

export const CLE_ONGLETS = "facture-ae:onglets";
export const NB_ONGLETS = 4;

/** Par défaut : agenda, devis, factures, interventions (le terrain). */
export const ONGLETS_PAR_DEFAUT = ["/agenda", "/devis", "/factures", "/interventions"];

/** Écrans proposés au choix (tout sauf les réglages). */
export const ONGLETS_POSSIBLES = NAV_ITEMS.filter((n) => n.href !== "/parametres").map((n) => ({ href: n.href, label: n.label }));

/**
 * Valeur mémorisée → liste de 4 liens valides et distincts, sinon la
 * liste par défaut (valeur absente, abîmée, lien inconnu…).
 */
export function normaliserOnglets(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [...ONGLETS_PAR_DEFAUT];
  const connus = new Set(ONGLETS_POSSIBLES.map((o) => o.href));
  const propres: string[] = [];
  for (const v of valeur) {
    if (typeof v === "string" && connus.has(v) && !propres.includes(v)) propres.push(v);
  }
  return propres.length === NB_ONGLETS ? propres : [...ONGLETS_PAR_DEFAUT];
}

export function lireOnglets(): string[] {
  try {
    return normaliserOnglets(JSON.parse(localStorage.getItem(CLE_ONGLETS) ?? "null"));
  } catch {
    return [...ONGLETS_PAR_DEFAUT];
  }
}

export function ecrireOnglets(onglets: string[]): void {
  try {
    localStorage.setItem(CLE_ONGLETS, JSON.stringify(normaliserOnglets(onglets)));
    window.dispatchEvent(new Event("onglets-mobile"));
  } catch {
    // Stockage indisponible (navigation privée) : la barre garde ses valeurs.
  }
}
