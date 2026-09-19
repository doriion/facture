/**
 * Émetteur figé (« SIRET historisé ») : un document émis conserve les
 * mentions de l'émetteur telles qu'elles étaient AU MOMENT de
 * l'émission — raison sociale, adresse, SIRET, assurance décennale,
 * immatriculations. Règle générale des documents légaux : on fige, on
 * ne recalcule pas rétroactivement (indispensable avant un changement
 * d'adresse/SIRET).
 *
 * Le snapshot est un PARTIEL de profil_entreprise (mêmes clés) stocké
 * en jsonb sur factures.emetteur / devis.emetteur :
 *   - NULL tant que le document est en brouillon → PDF sur profil courant ;
 *   - figé au premier passage hors brouillon (envoi, paiement,
 *     acceptation), jamais réécrit ensuite.
 */

import type { Database } from "@/types/database";

type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

/** Champs du profil qui constituent les mentions émetteur d'un document. */
export const CHAMPS_EMETTEUR = [
  "nom",
  "prenom",
  "nom_commercial",
  "adresse_ligne1",
  "adresse_ligne2",
  "code_postal",
  "ville",
  "pays",
  "siret",
  "siren",
  "code_ape",
  "email_pro",
  "telephone",
  "site_web",
  "num_assurance_decennale",
  "assureur_decennale",
  "assureur_decennale_adresse",
  "zone_couverture_decennale",
  "num_rm",
  "num_rge_qualipac",
  "num_attestation_fluides_frigo",
  // Affichage TVA figé à l'émission : basculer le réglage plus tard
  // ne doit jamais changer un document déjà émis.
  "assujetti_tva",
] as const;

/**
 * Champs ajoutés au snapshot le 19/09/2026 (version 2) : pied de page
 * (pénalités, escompte, médiateur), RIB et validités d'attestations.
 * Modifier ces réglages réécrivait le pied de page et le RIB de
 * factures déjà envoyées.
 */
export const CHAMPS_EMETTEUR_V2 = [
  "penalites_retard_text",
  "escompte_text",
  "mediateur_nom",
  "mediateur_adresse",
  "mediateur_site_web",
  "iban",
  "bic",
  "banque_nom",
  "decennale_valide_jusquau",
  "fluides_valide_jusquau",
] as const;

export const VERSION_SNAPSHOT_EMETTEUR = 2;

export type EmetteurSnapshot = Partial<
  Pick<Profil, (typeof CHAMPS_EMETTEUR)[number] | (typeof CHAMPS_EMETTEUR_V2)[number]>
> & { _version?: number };

/** Extrait le snapshot émetteur du profil courant (clés null omises). */
export function buildEmetteurSnapshot(
  profil: Profil | null,
): EmetteurSnapshot | null {
  if (!profil) return null;
  const snapshot: Record<string, unknown> = { _version: VERSION_SNAPSHOT_EMETTEUR };
  for (const champ of [...CHAMPS_EMETTEUR, ...CHAMPS_EMETTEUR_V2]) {
    const v = profil[champ];
    if (v !== null && v !== undefined && v !== "") snapshot[champ] = v;
  }
  return snapshot as EmetteurSnapshot;
}

/**
 * Profil « effectif » pour le rendu d'un document : le profil courant
 * écrasé par le snapshot figé s'il existe. Les documents émis gardent
 * leurs mentions d'origine, les brouillons suivent le profil courant.
 */
export function profilEffectif(
  profil: Profil | null,
  emetteur: unknown,
): Profil | null {
  if (!emetteur || typeof emetteur !== "object") return profil;
  const snapshot = emetteur as EmetteurSnapshot;
  const base = (profil ?? {}) as Profil;
  const merged: Record<string, unknown> = { ...base };
  // Le snapshot fait AUTORITÉ sur tous les champs émetteur, y compris
  // ceux qu'il ne contient pas (valeur vide à l'émission) : sans ça, un
  // champ rempli APRÈS l'émission fuiterait dans un document déjà émis.
  for (const champ of CHAMPS_EMETTEUR) {
    merged[champ] = (snapshot[champ] as unknown) ?? null;
  }
  // Champs de la version 2 : autorité du snapshot seulement s'il a été
  // pris avec eux ; un snapshot plus ancien laisse le profil courant
  // (sinon le RIB disparaîtrait des factures déjà émises).
  if ((snapshot._version ?? 1) >= VERSION_SNAPSHOT_EMETTEUR) {
    for (const champ of CHAMPS_EMETTEUR_V2) {
      merged[champ] = (snapshot[champ] as unknown) ?? null;
    }
  }
  return merged as Profil;
}
