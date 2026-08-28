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
  "zone_couverture_decennale",
  "num_rm",
  "num_rge_qualipac",
  "num_attestation_fluides_frigo",
] as const;

export type EmetteurSnapshot = Partial<
  Pick<Profil, (typeof CHAMPS_EMETTEUR)[number]>
>;

/** Extrait le snapshot émetteur du profil courant (clés null omises). */
export function buildEmetteurSnapshot(
  profil: Profil | null,
): EmetteurSnapshot | null {
  if (!profil) return null;
  const snapshot: Record<string, unknown> = {};
  for (const champ of CHAMPS_EMETTEUR) {
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
  return merged as Profil;
}
