/**
 * Mentions légales obligatoires pour un auto-entrepreneur BTP en France.
 * Centralisées ici pour réutilisation dans les PDF (factures + devis).
 *
 * Sources :
 * - Article L.223-3 du CIBS (franchise TVA — ex-art. 293 B du CGI,
 *   recodifié par l'ordonnance 2025-1247 à compter du 01/09/2026)
 * - Article L441-10 et D441-5 du Code de commerce (pénalités de retard, indemnité 40€)
 * - Loi Hamon 2014 (médiateur de la consommation)
 * - Réglementation F-Gas (fluides frigorigènes)
 *
 * IMPORTANT : ne pas modifier ces textes sans validation juridique.
 */

/**
 * Date d'entrée en vigueur de la recodification TVA CGI → CIBS
 * (ordonnance n° 2025-1247). À partir de cette date, la mention de
 * franchise doit viser l'article L.223-3 du CIBS.
 */
export const DATE_BASCULE_MENTION_CIBS = "2026-09-01";

/**
 * Ancienne rédaction (art. 293 B du CGI) — conservée UNIQUEMENT pour
 * la réimpression fidèle des documents émis avant le 01/09/2026.
 * Ne pas utiliser pour de nouveaux documents : passer par
 * `mentionTvaFranchise(dateEmission)`.
 */
export const MENTION_TVA_FRANCHISE_CGI =
  "TVA non applicable, art. 293 B du CGI";

/** Nouvelle rédaction, applicable aux documents émis dès le 01/09/2026. */
export const MENTION_TVA_FRANCHISE_CIBS =
  "TVA non applicable, article L.223-3 du Code des impositions sur les biens et les services (CIBS)";

/**
 * Mention de franchise TVA à afficher sur un document, selon sa date
 * d'émission (YYYY-MM-DD). Les PDF étant régénérés à la volée à chaque
 * téléchargement, ce choix par date garantit qu'une facture émise avant
 * le 01/09/2026 se réimprime avec la mention en vigueur à son émission.
 * Sans date fournie, on prend la date du jour (nouveau document).
 */
export function mentionTvaFranchise(dateEmission?: string | null): string {
  const date = dateEmission || new Date().toISOString().slice(0, 10);
  return date >= DATE_BASCULE_MENTION_CIBS
    ? MENTION_TVA_FRANCHISE_CIBS
    : MENTION_TVA_FRANCHISE_CGI;
}

export const MENTION_AUTO_ENTREPRENEUR = "Auto-entrepreneur — Entreprise individuelle";

export const MENTION_INDEMNITE_RECOUVREMENT =
  "Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 € (art. D441-5 du Code de commerce).";

/**
 * Mention par défaut adaptée aux clients professionnels (B2B) :
 * - Taux supplétif L441-10 = 3× le taux d'intérêt légal si rien n'est
 *   stipulé au contrat.
 * - Indemnité forfaitaire 40 € pour frais de recouvrement.
 *
 * Pour les clients particuliers, l'utilisateur peut éditer ce texte
 * dans Paramètres → Profil pour mettre simplement « taux d'intérêt
 * légal » au lieu de « 3 fois le taux d'intérêt légal ».
 */
export const MENTION_PENALITES_RETARD_DEFAULT =
  "En cas de retard de paiement, application de pénalités au taux de 3 fois le taux d'intérêt légal, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 et D441-5 du Code de commerce).";

export const MENTION_ESCOMPTE_DEFAULT = "Pas d'escompte pour règlement anticipé.";

export const MENTION_DEVIS_GRATUIT = "Devis gratuit.";

export const MENTION_BON_POUR_ACCORD = "Bon pour accord, le :";

export const MENTION_DEVIS_VALIDITE = (jours: number) =>
  `Devis valable ${jours} jours à compter de la date d'émission.`;

/**
 * Formate la mention assurance décennale pour le pied de facture/devis.
 */
export function mentionDecennale(opts: {
  numero?: string | null;
  assureur?: string | null;
  zone?: string | null;
}): string | null {
  if (!opts.numero || !opts.assureur) return null;
  const zone = opts.zone || "France métropolitaine";
  return `Assurance décennale n° ${opts.numero} souscrite auprès de ${opts.assureur}, couvrant le territoire : ${zone}.`;
}

/**
 * Formate la mention attestation fluides frigorigènes (clim/PAC).
 */
export function mentionFluidesFrigo(numero?: string | null): string | null {
  if (!numero) return null;
  return `Attestation de capacité fluides frigorigènes catégorie I n° ${numero} (réglementation F-Gas).`;
}

/**
 * Formate la mention RGE QualiPAC.
 */
export function mentionRgeQualipac(numero?: string | null): string | null {
  if (!numero) return null;
  return `Qualification RGE QualiPAC n° ${numero}.`;
}

/**
 * Formate la mention médiateur de la consommation
 * (obligatoire pour les clients particuliers).
 */
export function mentionMediateur(opts: {
  nom?: string | null;
  siteWeb?: string | null;
  adresse?: string | null;
}): string | null {
  if (!opts.nom) return null;
  const parts = [`Médiateur de la consommation : ${opts.nom}`];
  if (opts.adresse) parts.push(opts.adresse);
  if (opts.siteWeb) parts.push(opts.siteWeb);
  return parts.join(" — ");
}

/**
 * Mention RM (inscription Répertoire des Métiers).
 */
export function mentionRm(numero?: string | null): string | null {
  if (!numero) return null;
  return `Inscrit au Répertoire des Métiers — n° ${numero}.`;
}

/**
 * Libellés FR des types d'activité (pour affichage UI/PDF).
 */
export const LABELS_TYPE_ACTIVITE = {
  plomberie: "Plomberie",
  installation_clim: "Installation climatisation",
  installation_pac: "Installation pompe à chaleur",
  entretien: "Entretien",
  depannage: "Dépannage",
  autre: "Autre",
} as const;

/**
 * Libellés FR des statuts de facture.
 */
export const LABELS_STATUT_FACTURE = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  retard: "En retard",
  annulee: "Annulée",
} as const;

/**
 * Libellés FR des statuts de devis.
 */
export const LABELS_STATUT_DEVIS = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
} as const;
