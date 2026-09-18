/**
 * Logique PURE du modèle de devis — aucune I/O, aucun JSX, testée dans
 * devis-modele.test.ts. Le composant PDF ne fait que mettre en page ce
 * que ces fonctions calculent.
 *
 * Règle de version : un devis porte le numéro de modèle figé à sa
 * création (devis.pdf_template_version). NULL = modèle historique, et
 * un devis déjà émis se réimprime donc à l'identique, indéfiniment.
 */

import { formatEuros, formatSiret } from "@/lib/format";
import {
  mentionFluidesFrigo,
  mentionMediateur,
  mentionRgeQualipac,
  mentionRm,
} from "@/lib/legal-text";

/** Modèle d'origine — rend tous les devis émis avant la migration. */
export const MODELE_DEVIS_HISTORIQUE = 1;
/** Modèle simple, posé sur les devis créés depuis la migration. */
export const MODELE_DEVIS_SIMPLE = 2;

export function versionModeleDevis(valeur: unknown): 1 | 2 {
  return Number(valeur) === MODELE_DEVIS_SIMPLE
    ? MODELE_DEVIS_SIMPLE
    : MODELE_DEVIS_HISTORIQUE;
}

type ProfilEntete = {
  nom?: string | null;
  prenom?: string | null;
  nom_commercial?: string | null;
  adresse_ligne1?: string | null;
  adresse_ligne2?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  telephone?: string | null;
  email_pro?: string | null;
  siret?: string | null;
  num_assurance_decennale?: string | null;
  assureur_decennale?: string | null;
  num_attestation_fluides_frigo?: string | null;
  num_rge_qualipac?: string | null;
  num_rm?: string | null;
  mediateur_nom?: string | null;
  mediateur_site_web?: string | null;
  mediateur_adresse?: string | null;
};

/**
 * Raison affichée en tête : nom commercial, sinon prénom + nom, suivi
 * de la mention « EI » obligatoire pour l'entrepreneur individuel
 * (loi du 14 février 2022). Jamais dupliquée si déjà présente.
 */
export function enseigneEmetteur(profil: ProfilEntete | null): string {
  const base =
    (profil?.nom_commercial || "").trim() ||
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ").trim() ||
    "Auto-entrepreneur";
  return /(^|\s)EI(\s|$)/.test(base) ? base : `${base} EI`;
}

/**
 * Coordonnées de l'en-tête, une entrée par ligne, sans libellé :
 * adresse, code postal + ville, téléphone, email. Les champs vides
 * disparaissent au lieu de laisser une ligne blanche.
 */
export function coordonneesEmetteur(profil: ProfilEntete | null): string[] {
  const villeLigne = [profil?.code_postal, profil?.ville]
    .filter(Boolean)
    .join(" ")
    .trim();
  return [
    (profil?.adresse_ligne1 || "").trim(),
    (profil?.adresse_ligne2 || "").trim(),
    villeLigne,
    (profil?.telephone || "").trim(),
    (profil?.email_pro || "").trim(),
  ].filter((l) => l.length > 0);
}

/**
 * Pied de page discret, sur UNE ligne : SIRET puis assurance. Les deux
 * parties sont facultatives — rien d'inventé si le profil est
 * incomplet, la ligne se réduit ou disparaît.
 */
export function ligneePiedDePage(profil: ProfilEntete | null): string {
  const morceaux: string[] = [];
  if (profil?.siret) morceaux.push(`SIRET ${formatSiret(profil.siret)}`);

  if (profil?.num_assurance_decennale) {
    const assureur = (profil.assureur_decennale || "").trim();
    morceaux.push(
      assureur
        ? `Assurance décennale ${assureur} n° ${profil.num_assurance_decennale}`
        : `Assurance décennale n° ${profil.num_assurance_decennale}`,
    );
  }
  return morceaux.join(" — ");
}

/**
 * Deuxième ligne du pied de page : les mentions que la loi impose sur
 * un devis selon le contexte, et que le modèle simple omettait (le
 * modèle historique les imprimait déjà) :
 * - attestation de capacité fluides frigorigènes (F-Gas) : obligatoire
 *   sur devis ET facture dès qu'on manipule du fluide (clim, PAC) ;
 * - RGE QualiPAC, seulement pour clim/PAC (conditionne les aides) ;
 * - immatriculation au Répertoire des Métiers (artisan) ;
 * - médiateur de la consommation : clients particuliers seulement
 *   (art. L616-1 du Code de la consommation).
 * Comme la première ligne : rien d'inventé, une mention absente du
 * profil n'est pas imprimée.
 */
export function mentionsReglementairesDevis(
  profil: ProfilEntete | null,
  contexte: { typeActivite?: string | null; typeClient?: string | null },
): string {
  const climPac =
    contexte.typeActivite === "installation_clim" ||
    contexte.typeActivite === "installation_pac";
  const morceaux = [
    climPac ? mentionFluidesFrigo(profil?.num_attestation_fluides_frigo) : null,
    climPac ? mentionRgeQualipac(profil?.num_rge_qualipac) : null,
    mentionRm(profil?.num_rm),
    contexte.typeClient === "particulier"
      ? mentionMediateur({
          nom: profil?.mediateur_nom,
          siteWeb: profil?.mediateur_site_web,
          adresse: profil?.mediateur_adresse,
        })
      : null,
  ].filter((m): m is string => Boolean(m));
  return morceaux.join(" — ");
}

/**
 * Nombre de jours de validité affiché à côté de la date limite.
 * Renvoie null si l'une des dates manque ou si l'écart est négatif —
 * on n'imprime alors aucune parenthèse plutôt qu'une valeur absurde.
 */
export function joursDeValidite(
  dateEmission: string | null | undefined,
  dateValidite: string | null | undefined,
): number | null {
  if (!dateEmission || !dateValidite) return null;
  const debut = Date.parse(`${dateEmission}T00:00:00Z`);
  const fin = Date.parse(`${dateValidite}T00:00:00Z`);
  if (Number.isNaN(debut) || Number.isNaN(fin)) return null;
  const jours = Math.round((fin - debut) / (24 * 3600 * 1000));
  return jours > 0 ? jours : null;
}

/**
 * Ligne d'acompte affichée sous les totaux, sur UNE ligne :
 *   « Acompte 40 % à la commande : 1 800,00 € — solde 60 % : 2 700,00 €
 *     à la fin des travaux »
 *
 * Le pourcentage prime sur le montant fixe, comme partout ailleurs
 * dans l'application. Sans acompte renseigné, renvoie null : le PDF
 * n'imprime alors rien du tout, pas même une ligne vide.
 */
export function ligneAcompte(
  totalHt: number,
  acomptePct: number | null | undefined,
  acompteMontant: number | null | undefined,
): string | null {
  const total = Number(totalHt);
  if (!Number.isFinite(total) || total <= 0) return null;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  let montant: number | null = null;
  let pct: number | null = null;

  if (acomptePct !== null && acomptePct !== undefined && Number(acomptePct) > 0) {
    pct = Number(acomptePct);
    montant = round2((total * pct) / 100);
  } else if (
    acompteMontant !== null &&
    acompteMontant !== undefined &&
    Number(acompteMontant) > 0
  ) {
    montant = round2(Number(acompteMontant));
  }
  if (montant === null) return null;

  // Un acompte supérieur au total n'a pas de sens : on le borne pour
  // ne jamais imprimer un solde négatif.
  montant = Math.min(montant, total);
  const solde = round2(total - montant);

  const enPct = (v: number) =>
    Number.isInteger(v) ? String(v) : v.toLocaleString("fr-FR");

  if (pct === null) {
    return `Acompte à la commande : ${formatEuros(montant)} — solde : ${formatEuros(solde)} à la fin des travaux`;
  }
  const soldePct = round2(100 - pct);
  return `Acompte ${enPct(pct)} % à la commande : ${formatEuros(montant)} — solde ${enPct(soldePct)} % : ${formatEuros(solde)} à la fin des travaux`;
}
