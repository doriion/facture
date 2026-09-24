/**
 * Mentions légales obligatoires pour un auto-entrepreneur BTP en France.
 * Centralisées ici pour réutilisation dans les PDF (factures + devis).
 *
 * Sources :
 * - Article L. 223-3 du CIBS (franchise TVA — ex-art. 293 B du CGI,
 *   recodifié par l'ordonnance 2025-1247 ; bascule retenue au
 *   01/09/2026, voir DATE_BASCULE_MENTION_CIBS)
 * - Article L441-10 et D441-5 du Code de commerce (pénalités de retard, indemnité 40€)
 * - Loi Hamon 2014 (médiateur de la consommation)
 * - Réglementation F-Gas (fluides frigorigènes)
 *
 * IMPORTANT : ne pas modifier ces textes sans validation juridique.
 */

import { aujourdhuiParis } from "@/lib/dates";

/**
 * Date de bascule CGI → CIBS pour la mention de franchise.
 *
 * FIXÉE AU 01/09/2026 SUR DEMANDE EXPRESSE DE L'UTILISATEUR
 * (14/09/2026), qui retient cette date comme celle de l'entrée en
 * vigueur de la recodification (ordonnance 2025-1247).
 *
 * HISTORIQUE À CONSERVER : une vérification faite le 02/09/2026 avait
 * conclu à un report au 01/01/2027 par l'ordonnance n° 2026-671 du
 * 27 juillet 2026, et la constante valait alors "2027-01-01".
 * L'utilisateur, seul responsable de ses mentions légales, a demandé
 * à trois reprises la bascule au 01/09/2026 ; c'est sa décision qui
 * s'applique ici. Pour revenir en arrière, il suffit de remettre
 * "2027-01-01" : aucune autre ligne n'est à toucher.
 *
 * EFFET DE BORD MESURÉ AU MOMENT DU CHANGEMENT : les documents émis à
 * partir du 01/09/2026 se réimpriment désormais avec la mention CIBS
 * (2 factures et 1 contrat en base, aucun devis). Les documents
 * antérieurs ne bougent pas.
 *
 * Les références au CGI restent tolérées jusqu'au 30/06/2028, donc
 * aucun document déjà envoyé n'est irrégulier de ce fait.
 */
export const DATE_BASCULE_MENTION_CIBS = "2026-09-01";

/**
 * Rédaction historique (art. 293 B du CGI) — utilisée pour les
 * documents émis AVANT la bascule, et tolérée jusqu'au 30/06/2028.
 * Ne pas utiliser directement : passer par
 * `mentionTvaFranchise(dateEmission)`.
 */
export const MENTION_TVA_FRANCHISE_CGI =
  "TVA non applicable, art. 293 B du CGI";

/** Nouvelle rédaction, applicable aux documents émis après la bascule. */
export const MENTION_TVA_FRANCHISE_CIBS =
  "TVA non applicable, article L. 223-3 du Code des impositions sur les biens et les services (CIBS)";

/**
 * Mention de franchise TVA à afficher sur un document, selon sa date
 * d'émission (YYYY-MM-DD). Les PDF étant régénérés à la volée à chaque
 * téléchargement, ce choix par date garantit qu'une facture émise avant
 * le 01/09/2026 se réimprime avec la mention en vigueur à son émission.
 * Sans date fournie, on prend la date du jour (nouveau document).
 */
export function mentionTvaFranchise(dateEmission?: string | null): string {
  const date = dateEmission || aujourdhuiParis();
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

/**
 * Pénalités de retard pour un client PARTICULIER : l'indemnité
 * forfaitaire de 40 € (D441-5) ne s'applique qu'entre professionnels ;
 * on n'imprime que le taux légal.
 */
export const MENTION_PENALITES_RETARD_PARTICULIER =
  "En cas de retard de paiement, des pénalités au taux de l'intérêt légal en vigueur seront appliquées (art. L441-10 du Code de commerce).";

/** Texte des pénalités selon le type de client, sauf texte personnalisé. */
export function mentionPenalitesRetard(
  texteProfil: string | null | undefined,
  typeClient: string | null | undefined,
): string {
  if (texteProfil && texteProfil.trim()) return texteProfil;
  return typeClient === "particulier"
    ? MENTION_PENALITES_RETARD_PARTICULIER
    : MENTION_PENALITES_RETARD_DEFAULT;
}

/**
 * Droit de rétractation — contrat conclu HORS ÉTABLISSEMENT (devis
 * signé au domicile du client). Art. L221-18 du Code de la
 * consommation, vérifié le 02/09/2026 : 14 jours calendaires à compter
 * du LENDEMAIN de la conclusion du contrat. Sans remise du formulaire
 * de rétractation, le délai est prolongé de 12 mois (art. L221-20) —
 * d'où le formulaire détachable imprimé avec la mention.
 */
export const MENTION_RETRACTATION_L221_18 =
  "Contrat conclu hors établissement : conformément à l'article L221-18 du Code de la consommation, vous disposez d'un délai de quatorze jours pour exercer votre droit de rétractation, sans avoir à motiver votre décision. Ce délai court à compter du lendemain de la conclusion du contrat (signature du présent devis). Pour l'exercer, adressez-nous, avant l'expiration du délai, le formulaire ci-dessous ou toute autre déclaration dénuée d'ambiguïté, par courrier ou par email. Les travaux ne peuvent commencer avant la fin du délai de rétractation, sauf demande expresse de votre part.";

/**
 * Contrat conclu À DISTANCE (devis accepté par email ou via un lien,
 * sans présence physique) : même délai de 14 jours (art. L221-18), le
 * point de départ est identique pour une prestation de services.
 */
export const MENTION_RETRACTATION_DISTANCE =
  "Contrat conclu à distance : conformément à l'article L221-18 du Code de la consommation, vous disposez d'un délai de quatorze jours pour exercer votre droit de rétractation, sans avoir à motiver votre décision. Ce délai court à compter du lendemain de la conclusion du contrat (acceptation du présent devis). Pour l'exercer, adressez-nous, avant l'expiration du délai, le formulaire ci-dessous ou toute autre déclaration dénuée d'ambiguïté, par courrier ou par email. Les travaux ne peuvent commencer avant la fin du délai de rétractation, sauf demande expresse de votre part.";

/** Modes de conclusion d'un devis (colonne devis.mode_conclusion). */
export const MODES_CONCLUSION_DEVIS = ["etablissement", "hors_etablissement", "distance"] as const;
export type ModeConclusionDevis = (typeof MODES_CONCLUSION_DEVIS)[number];

export const LABELS_MODE_CONCLUSION: Record<ModeConclusionDevis, string> = {
  etablissement: "Signé dans mon local (pas de rétractation)",
  hors_etablissement: "Signé chez le client (hors établissement)",
  distance: "Accepté à distance (email, lien, téléphone)",
};

/** Mention de rétractation à imprimer selon le mode, null si aucune. */
export function mentionRetractation(mode: string | null | undefined): string | null {
  if (mode === "hors_etablissement") return MENTION_RETRACTATION_L221_18;
  if (mode === "distance") return MENTION_RETRACTATION_DISTANCE;
  return null;
}

/**
 * Mention manuscrite exigée sur un devis de travaux du bâtiment
 * (arrêté du 24 janvier 2017) : à recopier par le client au moment de
 * l'acceptation.
 */
export const MENTION_DEVIS_RECU_AVANT_TRAVAUX =
  "Mention manuscrite à porter par le client : « Devis reçu avant l'exécution des travaux »";

/** Formulaire de rétractation type (annexe à l'art. R221-1 c. conso, simplifié). */
export const FORMULAIRE_RETRACTATION_LIGNES = [
  "FORMULAIRE DE RÉTRACTATION (à compléter et renvoyer uniquement si vous souhaitez vous rétracter)",
  "À l'attention de : (nom et adresse de l'entreprise — voir en-tête)",
  "Je vous notifie par la présente ma rétractation du contrat portant sur la prestation ci-dessus, conclu le : ……………………",
  "Nom du consommateur : ……………………  Adresse : …………………………………………",
  "Signature :                              Date : ……………………",
] as const;

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
  /** Coordonnées de l'assureur (adresse) — exigées par l'art. 22-2 de la loi 96-603 */
  assureurAdresse?: string | null;
  zone?: string | null;
  /** Fin de validité de l'attestation (YYYY-MM-DD) : rien n'est imprimé au-delà. */
  valideJusquau?: string | null;
  /** Date du document (YYYY-MM-DD) à laquelle comparer la validité. */
  dateDocument?: string | null;
}): string | null {
  if (!opts.numero || !opts.assureur) return null;
  if (estExpiree(opts.valideJusquau, opts.dateDocument)) return null;
  const coordonnees = opts.assureurAdresse ? ` (${opts.assureurAdresse})` : "";
  // Zone de couverture : imprimée seulement si elle est renseignée — on
  // n'affirme pas une étendue de garantie qui n'a jamais été saisie.
  const zone = opts.zone?.trim() ? `, couvrant le territoire : ${opts.zone.trim()}` : "";
  return `Assurance décennale n° ${opts.numero} souscrite auprès de ${opts.assureur}${coordonnees}${zone}.`;
}

/** Attestation expirée à la date du document ? (sans date de validité : non) */
export function estExpiree(
  valideJusquau: string | null | undefined,
  dateDocument: string | null | undefined,
): boolean {
  if (!valideJusquau) return false;
  const ref = dateDocument || aujourdhuiParis();
  return valideJusquau < ref;
}

/**
 * Formate la mention attestation fluides frigorigènes (clim/PAC).
 */
export function mentionFluidesFrigo(
  numero?: string | null,
  opts: { valideJusquau?: string | null; dateDocument?: string | null } = {},
): string | null {
  if (!numero) return null;
  if (estExpiree(opts.valideJusquau, opts.dateDocument)) return null;
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
  ventilee: "Ventilée (acompte / solde)",
  annulee: "Annulée",
  // Avoirs (statuts affichés, dérivés de envoyee/payee — voir
  // lib/factures-transitions statutAffichageFacture)
  avoir_emis: "Avoir émis",
  avoir_a_rembourser: "Avoir à rembourser",
  avoir_rembourse: "Avoir remboursé",
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
