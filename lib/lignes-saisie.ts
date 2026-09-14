/**
 * Saisie des lignes (quantité, prix unitaire) — logique PURE, testée
 * dans lignes-saisie.test.ts.
 *
 * Les champs Quantité et Prix unitaire d'une nouvelle ligne sont VIDES
 * (placeholder grisé « 1 » / « 0,00 ») pour qu'on puisse taper
 * directement sans effacer. Les valeurs par défaut ne s'appliquent
 * qu'à l'interprétation : une quantité laissée vide compte pour 1, un
 * prix laissé vide pour 0 — dans les totaux affichés en direct comme à
 * l'enregistrement (schéma Zod). Les calculs eux-mêmes ne changent
 * pas : quantité × prix, arrondi au centime, comme avant.
 */

import { parseMoneyInput } from "@/lib/format";

/** Quantité retenue quand le champ est laissé vide. */
export const QUANTITE_DEFAUT = 1;

/** Champ laissé vide (ou jamais rempli). */
export function champVide(v: unknown): boolean {
  return v === "" || v === null || v === undefined;
}

/**
 * Prétraitement Zod de la quantité : vide → 1, sinon nombre tolérant
 * FR/EN (« 2,5 », « 1 000 »). Une saisie non numérique reste NaN pour
 * que le schéma la refuse avec son message habituel.
 */
export function quantiteSaisie(v: unknown): number {
  return champVide(v) ? QUANTITE_DEFAUT : parseMoneyInput(v);
}

/** Prétraitement Zod du prix unitaire : vide → 0, sinon nombre tolérant. */
export function prixSaisi(v: unknown): number {
  return champVide(v) ? 0 : parseMoneyInput(v);
}

/**
 * Quantité utilisée par les totaux affichés EN DIRECT pendant la
 * frappe : vide → 1, invalide → 0 (jamais NaN à l'écran).
 */
export function quantiteEffective(v: unknown): number {
  const n = quantiteSaisie(v);
  return Number.isFinite(n) ? n : 0;
}

/** Prix unitaire pour les totaux en direct : vide ou invalide → 0. */
export function prixEffectif(v: unknown): number {
  const n = prixSaisi(v);
  return Number.isFinite(n) ? n : 0;
}
