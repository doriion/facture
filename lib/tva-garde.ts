/**
 * Garde-fou « Moteur TVA non implémenté » — PUR, testé dans
 * tva-garde.test.ts.
 *
 * L'application ne sait pas calculer la TVA (auto-entrepreneur en
 * franchise en base, art. 293 B du CGI). Le réglage assujetti_tva ne
 * pilote aujourd'hui QUE des libellés (« HT » ou non). Si un document
 * se retrouve marqué assujetti — réglage basculé, snapshot importé —
 * rendre un PDF ou l'envoyer produirait un document FAUX (net à payer
 * sans TVA). On refuse donc explicitement le rendu tant qu'un vrai
 * moteur TVA n'existe pas.
 *
 * L'assujettissement lu est celui du DOCUMENT : le snapshot émetteur
 * figé fait autorité (un document émis avant le réglage n'a pas le
 * champ → false), le profil courant ne compte que pour un brouillon.
 */

import { profilEffectif } from "@/lib/emetteur";
import type { Database } from "@/types/database";

type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

export const MESSAGE_MOTEUR_TVA = "Moteur TVA non implémenté";

/**
 * Message exact selon l'origine de l'assujettissement :
 *  - brouillon (pas de snapshot) → le réglage courant est en cause, il
 *    suffit de le décocher ;
 *  - document émis → le snapshot est figé et n'est jamais réécrit (règle
 *    du SIRET historisé) : décocher le réglage ne débloquera PAS ce
 *    document-là. Ne pas promettre un remède qui n'existe pas.
 */
export function explicationMoteurTva(documentEmis: boolean): string {
  if (documentEmis) {
    return (
      `${MESSAGE_MOTEUR_TVA} : ce document a été émis avec des mentions ` +
      "« assujetti à la TVA » figées, or l'application ne calcule pas la " +
      "TVA. Le rendu est bloqué pour ne pas produire un document faux. Les " +
      "mentions d'un document émis ne sont jamais réécrites : décocher le " +
      "réglage ne débloquera pas celui-ci. Les documents créés après avoir " +
      "décoché « Assujetti à la TVA » dans Paramètres sortiront normalement."
    );
  }
  return (
    `${MESSAGE_MOTEUR_TVA} : ce brouillon est marqué « assujetti à la TVA », ` +
    "or l'application ne calcule pas la TVA. Le rendu est bloqué pour ne pas " +
    "produire un document faux — décochez « Assujetti à la TVA » dans " +
    "Paramètres si c'est une erreur."
  );
}

/** Un snapshot émetteur exploitable signe un document déjà émis. */
export function documentEmis(emetteur: unknown): boolean {
  return !!emetteur && typeof emetteur === "object";
}

export class MoteurTvaNonImplementeError extends Error {
  readonly explication: string;

  constructor(emetteur?: unknown) {
    super(MESSAGE_MOTEUR_TVA);
    this.name = "MoteurTvaNonImplementeError";
    this.explication = explicationMoteurTva(documentEmis(emetteur));
  }
}

/** Assujettissement effectif d'un document (snapshot prioritaire). */
export function assujettiTvaEffectif(
  profil: Profil | null,
  emetteur: unknown,
): boolean {
  return profilEffectif(profil, emetteur)?.assujetti_tva === true;
}

/**
 * Lève MoteurTvaNonImplementeError si le document exige un calcul de
 * TVA. À appeler AVANT tout rendu PDF (route, email).
 */
export function verifierMoteurTva(
  profil: Profil | null,
  emetteur: unknown,
): void {
  if (assujettiTvaEffectif(profil, emetteur)) {
    throw new MoteurTvaNonImplementeError(emetteur);
  }
}

export function estErreurMoteurTva(
  e: unknown,
): e is MoteurTvaNonImplementeError {
  return e instanceof MoteurTvaNonImplementeError;
}
