import { formatDateFr, formatEuros } from "@/lib/format";
import type { Database } from "@/types/database";
import type { EquipementContrat } from "@/lib/contrats/types";

/**
 * Préparation du rendu d'un contrat (page publique, aperçu admin, PDF) :
 * snapshot prestataire et carte des valeurs qui remplissent les espaces
 * réservés du template. Pas d'I/O — utilisable des deux côtés.
 */

type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];
export type ContratRow = Database["public"]["Tables"]["contrats"]["Row"];

/**
 * Snapshot prestataire figé à l'envoi du contrat. Reprend les champs
 * émetteur des documents (lib/emetteur.ts) + ceux propres au contrat :
 * médiation consommation (art. 12) et validité décennale.
 */
export const CHAMPS_PRESTATAIRE = [
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
  "mediateur_nom",
  "mediateur_adresse",
  "mediateur_site_web",
  "decennale_valide_jusquau",
  "fluides_valide_jusquau",
] as const;

export type PrestataireSnapshot = Partial<
  Pick<Profil, (typeof CHAMPS_PRESTATAIRE)[number]>
>;

export function buildPrestataireSnapshot(
  profil: Profil | null,
): PrestataireSnapshot | null {
  if (!profil) return null;
  const snapshot: Record<string, unknown> = {};
  for (const champ of CHAMPS_PRESTATAIRE) {
    const v = profil[champ];
    if (v !== null && v !== undefined && v !== "") snapshot[champ] = v;
  }
  return snapshot as PrestataireSnapshot;
}

/**
 * Prestataire « effectif » : le snapshot figé s'il existe (contrat
 * envoyé/signé), sinon le profil courant (brouillon). Comme pour les
 * factures, le snapshot fait autorité même sur ses champs absents.
 */
export function prestataireEffectif(
  profil: Profil | null,
  snapshot: unknown,
): PrestataireSnapshot {
  if (!snapshot || typeof snapshot !== "object") {
    return buildPrestataireSnapshot(profil) ?? {};
  }
  const s = snapshot as PrestataireSnapshot;
  const resultat: Record<string, unknown> = {};
  for (const champ of CHAMPS_PRESTATAIRE) {
    resultat[champ] = (s[champ] as unknown) ?? null;
  }
  return resultat as PrestataireSnapshot;
}

/** Coordonnées du client figées / complétées à la signature. */
export type ClientSnapshot = {
  nom?: string | null;
  raison_sociale?: string | null;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  siret?: string | null;
};

export function nomAffichagePrestataire(p: PrestataireSnapshot): string {
  return (
    p.nom_commercial ||
    [p.prenom, p.nom].filter(Boolean).join(" ") ||
    "Le prestataire"
  );
}

export function adresseAffichagePrestataire(p: PrestataireSnapshot): string {
  return [
    p.adresse_ligne1,
    p.adresse_ligne2,
    [p.code_postal, p.ville].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Les valeurs qui remplissent les espaces réservés {commeCeci} du
 * template (voir remplirTexte). Clé absente → pointillés au rendu.
 */
export function valeursTemplate(args: {
  contrat: Pick<
    ContratRow,
    "numero" | "plafond_pieces" | "date_effet"
  >;
  prestataire: PrestataireSnapshot;
}): Record<string, string> {
  const { contrat, prestataire } = args;
  const mediateur = [
    prestataire.mediateur_nom,
    prestataire.mediateur_adresse,
    prestataire.mediateur_site_web,
  ]
    .filter(Boolean)
    .join(" — ");

  return {
    numeroContrat: contrat.numero ?? "",
    plafondPieces:
      Number(contrat.plafond_pieces) > 0
        ? formatEuros(Number(contrat.plafond_pieces))
        : "",
    dateEffet: contrat.date_effet ? formatDateFr(contrat.date_effet) : "",
    numAttestationFluides: prestataire.num_attestation_fluides_frigo ?? "",
    assureurDecennale: prestataire.assureur_decennale ?? "",
    numeroPoliceDecennale: prestataire.num_assurance_decennale ?? "",
    mediateur,
    prestataireNom: nomAffichagePrestataire(prestataire),
    prestataireAdresse: adresseAffichagePrestataire(prestataire),
    prestataireEmail: prestataire.email_pro ?? "",
  };
}

/** Lecture tolérante du JSONB equipements. */
export function equipementsDe(contrat: {
  equipements: unknown;
}): EquipementContrat[] {
  if (!Array.isArray(contrat.equipements)) return [];
  return (contrat.equipements as Array<Record<string, unknown>>).map((e) => ({
    type: String(e.type ?? ""),
    marque_modele: String(e.marque_modele ?? ""),
    num_serie: String(e.num_serie ?? ""),
    puissance_kw: String(e.puissance_kw ?? ""),
    fluide_charge: String(e.fluide_charge ?? ""),
  }));
}
