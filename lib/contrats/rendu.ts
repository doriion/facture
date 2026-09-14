import { formatDateFr, formatEuros } from "@/lib/format";
import {
  MENTION_TVA_FRANCHISE_CGI,
  mentionTvaFranchise,
} from "@/lib/legal-text";
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
  "assujetti_tva",
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
 * Date qui fait foi pour les mentions légales datées d'un contrat
 * (aujourd'hui : la seule mention de franchise de TVA, dont la
 * rédaction a changé le 01/09/2026 — voir lib/legal-text).
 *
 * On retient la signature si elle a eu lieu, sinon l'envoi au client,
 * sinon rien : un brouillon prend alors la date du jour. Le contrat
 * porte ainsi la rédaction en vigueur au moment où il a été conclu, et
 * un contrat ancien régénéré ne se voit pas réécrire sa mention.
 *
 * `date_effet` est volontairement ignorée : elle peut être future.
 */
export function dateReferenceContrat(contrat: {
  signed_at?: string | null;
  sent_at?: string | null;
}): string | null {
  const horodatage = contrat.signed_at || contrat.sent_at;
  return horodatage ? horodatage.slice(0, 10) : null;
}

/**
 * Mention de franchise de TVA d'un contrat — le SEUL endroit qui en
 * décide, pour le corps du texte comme pour le pied de page du PDF.
 *
 * Elle suit la VERSION du contrat avant de suivre sa date :
 *
 * - version 1 : le texte de l'article 6.1 porte l'ancienne rédaction
 *   écrite en dur dans un fichier figé. Le pied de page doit dire la
 *   même chose, sans quoi un contrat régénéré se contredirait d'une
 *   page à l'autre. Un contrat v1 se réimprime donc exactement comme
 *   le client l'a reçu, y compris s'il a été signé après la bascule.
 * - version 2 et au-delà : la mention vient de lib/legal-text, choisie
 *   d'après la date du contrat, exactement comme les devis et les
 *   factures.
 */
export function mentionTvaContrat(contrat: {
  template_version: number;
  signed_at?: string | null;
  sent_at?: string | null;
}): string {
  if (Number(contrat.template_version) <= 1) return MENTION_TVA_FRANCHISE_CGI;
  return mentionTvaFranchise(dateReferenceContrat(contrat));
}

/**
 * Les valeurs qui remplissent les espaces réservés {commeCeci} du
 * template (voir remplirTexte). Clé absente → pointillés au rendu.
 */
export function valeursTemplate(args: {
  contrat: Pick<
    ContratRow,
    | "numero"
    | "plafond_pieces"
    | "date_effet"
    | "signed_at"
    | "sent_at"
    | "template_version"
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
    // Espace réservé du template v2. Jamais écrit en dur dans un
    // texte de contrat — le template v1, figé, reste l'exception
    // historique, et il n'utilise pas cet espace réservé.
    mentionTvaFranchise: mentionTvaContrat(contrat),
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
