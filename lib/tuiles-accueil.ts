/**
 * Tuiles de l'écran d'accueil du téléphone — logique PURE, testée.
 * Grandes tuiles choisies et ordonnées par l'utilisateur, mémorisées
 * sur l'appareil (localStorage) : écrans de l'application et actions
 * rapides (nouveau devis, nouvelle facture…).
 */

import type { LucideIcon } from "lucide-react";
import { CalendarPlus, FilePlus2, ListPlus, Receipt, Snowflake } from "lucide-react";

import { NAV_ITEMS } from "@/lib/constants";

export const CLE_TUILES = "facture-ae:tuiles";

export type Tuile = { href: string; label: string; icon: LucideIcon; description?: string; action?: boolean };

/** Actions rapides proposées en plus des écrans. */
export const ACTIONS_RAPIDES: Tuile[] = [
  { href: "/devis/nouveau", label: "Nouveau devis", icon: FilePlus2, description: "Créer un devis", action: true },
  { href: "/factures/nouvelle", label: "Nouvelle facture", icon: Receipt, description: "Créer une facture", action: true },
  { href: "/fiches-gaz/nouvelle", label: "Nouvelle fiche gaz", icon: Snowflake, description: "CERFA + bon de réception", action: true },
  { href: "/interventions/nouvelle", label: "Nouvelle intervention", icon: CalendarPlus, description: "Planifier un rendez-vous", action: true },
  { href: "/taches?ajouter=1", label: "Nouvelle tâche", icon: ListPlus, description: "À ne pas oublier", action: true },
];

/** Tout ce qui peut devenir une tuile : écrans (sauf l'accueil lui-même) puis actions. */
export const TUILES_POSSIBLES: Tuile[] = [
  ...NAV_ITEMS.filter((n) => n.href !== "/accueil").map((n) => ({ href: n.href, label: n.label, icon: n.icon, description: n.description })),
  ...ACTIONS_RAPIDES,
];

/** Par défaut : les écrans du terrain, puis deux actions. */
export const TUILES_PAR_DEFAUT = ["/agenda", "/devis", "/factures", "/clients", "/interventions", "/fiches-gaz", "/taches", "/devis/nouveau"];

const connues = () => new Set(TUILES_POSSIBLES.map((t) => t.href));

/** Valeur mémorisée → liste de liens valides et distincts (au moins un), sinon le défaut. */
export function normaliserTuiles(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [...TUILES_PAR_DEFAUT];
  const ok = connues();
  const propres: string[] = [];
  for (const v of valeur) if (typeof v === "string" && ok.has(v) && !propres.includes(v)) propres.push(v);
  return propres.length > 0 ? propres : [...TUILES_PAR_DEFAUT];
}

export function tuilesDepuis(hrefs: string[]): Tuile[] {
  return hrefs.map((h) => TUILES_POSSIBLES.find((t) => t.href === h)).filter((t): t is Tuile => Boolean(t));
}

/** Déplace l'élément `index` de `delta` positions (bornes respectées). */
export function deplacer(liste: string[], index: number, delta: number): string[] {
  const cible = index + delta;
  if (index < 0 || index >= liste.length || cible < 0 || cible >= liste.length) return liste;
  const copie = [...liste];
  const [el] = copie.splice(index, 1);
  copie.splice(cible, 0, el!);
  return copie;
}

export function lireTuiles(): string[] {
  try {
    return normaliserTuiles(JSON.parse(localStorage.getItem(CLE_TUILES) ?? "null"));
  } catch {
    return [...TUILES_PAR_DEFAUT];
  }
}

export function ecrireTuiles(tuiles: string[]): void {
  try {
    localStorage.setItem(CLE_TUILES, JSON.stringify(normaliserTuiles(tuiles)));
  } catch {
    // Stockage indisponible (navigation privée) : l'accueil garde ses valeurs.
  }
}
