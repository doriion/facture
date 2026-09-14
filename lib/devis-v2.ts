/**
 * Logique PURE du modèle de devis v2 — aucune I/O, aucun JSX, testée
 * dans devis-v2.test.ts. Le composant PDF ne fait que mettre en page
 * ce que ces fonctions calculent.
 *
 * Rappel de la règle de version : un devis porte le numéro de modèle
 * figé à sa création (devis.pdf_template_version). NULL = v1, et un
 * devis déjà émis se réimprime donc à l'identique, indéfiniment.
 */

import { formatEuros } from "@/lib/format";

/** Version de modèle appliquée par défaut quand rien n'est stocké. */
export const MODELE_DEVIS_V1 = 1;
/** Version posée sur les devis créés depuis la migration. */
export const MODELE_DEVIS_V2 = 2;

export function versionModeleDevis(valeur: unknown): 1 | 2 {
  return Number(valeur) === MODELE_DEVIS_V2 ? MODELE_DEVIS_V2 : MODELE_DEVIS_V1;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Minuscules sans accents, avec deux normalisations que NFD ne fait
 * PAS : la ligature « œ » (qu'on écrit aussi « oe ») et l'apostrophe
 * typographique « ’ ». Sans elles, « Main d'œuvre » et « Main d'oeuvre »
 * ne se comparent pas.
 */
function sansAccents(s: string): string {
  return s
    .toLowerCase()
    .replace(/[œ]/g, "oe")
    .replace(/[æ]/g, "ae")
    .replace(/[’‘‛`]/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// ---------------------------------------------------------------------------
// Lignes
// ---------------------------------------------------------------------------

export type LigneV2 = {
  id?: string;
  designation: string;
  quantite: number | string;
  prix_unitaire_ht: number | string;
  total_ht: number | string;
  type?: string | null;
};

/**
 * Une ligne « MAIN D'ŒUVRE — 0 € » n'apporte rien au client et alourdit
 * le tableau : elle est retirée du rendu. Le filtre est VOLONTAIREMENT
 * étroit — main-d'œuvre ET montant nul ET prix unitaire nul — pour ne
 * jamais masquer une prestation offerte ou un geste commercial libellé
 * autrement. Les totaux ne bougent pas : ces lignes valent zéro.
 */
export function estLigneMainDoeuvreVide(l: LigneV2): boolean {
  if (l.type === "titre") return false;
  if (Number(l.total_ht) !== 0) return false;
  if (Number(l.prix_unitaire_ht) !== 0) return false;
  const d = sansAccents(l.designation ?? "");
  return d.includes("main d'oeuvre") || d.includes("main doeuvre");
}

/**
 * Retire les préfixes de quantité redondants : si la ligne porte déjà
 * une quantité de 2, la désignation « 2x Split mural » devient
 * « Split mural ». Formes reconnues : « 2x », « 2 x », « 2X ».
 * Une quantité différente de celle du préfixe est LAISSÉE telle quelle
 * (c'est peut-être un conditionnement, ex. « 2x 5 m » en quantité 3).
 */
export function nettoyerDesignation(
  designation: string,
  quantite: number | string,
): string {
  const q = Number(quantite);
  if (!Number.isFinite(q)) return designation;
  const m = designation.match(/^\s*(\d+(?:[.,]\d+)?)\s*[xX]\s+(.+)$/);
  if (!m) return designation;
  const prefixe = Number(m[1].replace(",", "."));
  if (prefixe !== q) return designation;
  return m[2].trim();
}

/** Lignes prêtes à l'impression : nettoyées et débarrassées du bruit. */
export function lignesPourRendu<T extends LigneV2>(lignes: T[]): T[] {
  return lignes
    .filter((l) => !estLigneMainDoeuvreVide(l))
    .map((l) =>
      l.type === "titre"
        ? l
        : { ...l, designation: nettoyerDesignation(l.designation, l.quantite) },
    );
}

// ---------------------------------------------------------------------------
// Acompte
// ---------------------------------------------------------------------------

export type Acompte = {
  montant: number;
  solde: number;
  /** Pourcentage affiché, null si l'acompte a été saisi en euros. */
  pct: number | null;
  phrase: string;
};

/**
 * Acompte du devis, avec le solde calculé. Le pourcentage prime sur le
 * montant fixe, comme dans le reste de l'application.
 * Exemple : « Acompte 40 % à la commande : 1 800,00 €, solde 2 700,00 €
 * à la fin des travaux. »
 */
export function acompteDevis(
  totalHt: number,
  acomptePct: number | null | undefined,
  acompteMontant: number | null | undefined,
): Acompte | null {
  const total = Number(totalHt);
  if (!Number.isFinite(total) || total <= 0) return null;

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

  // Un acompte supérieur au total n'a pas de sens : on le borne pour ne
  // jamais imprimer un solde négatif.
  montant = Math.min(montant, total);
  const solde = round2(total - montant);

  const pctAffiche =
    pct === null
      ? null
      : Number.isInteger(pct)
        ? String(pct)
        : pct.toLocaleString("fr-FR");

  const phrase =
    pctAffiche === null
      ? `Acompte à la commande : ${formatEuros(montant)}, solde ${formatEuros(solde)} à la fin des travaux.`
      : `Acompte ${pctAffiche} % à la commande : ${formatEuros(montant)}, solde ${formatEuros(solde)} à la fin des travaux.`;

  return { montant, solde, pct, phrase };
}

// ---------------------------------------------------------------------------
// Conditions de l'offre
// ---------------------------------------------------------------------------

/** Clauses toujours imprimées, quelle que soit la configuration. */
export const CLAUSE_MATERIEL_DISPO =
  "Matériel proposé sous réserve de disponibilité chez le fournisseur au moment de la commande.";
export const CLAUSE_TRAVAUX_SUPPLEMENTAIRES =
  "Tout travail supplémentaire non prévu au présent devis fera l'objet d'un devis complémentaire, accepté avant exécution.";

export type EntreeCondition = { label: string; valeur: string };

/**
 * Section « CONDITIONS DE L'OFFRE ». Les entrées vides sont omises :
 * un réglage non renseigné ne laisse pas de ligne orpheline.
 */
export function conditionsOffre(args: {
  delaiIntervention?: string | null;
  dureeEstimeeJours?: number | null;
  dateDebutTravaux?: string | null;
  fraisDeplacement?: string | null;
  validiteJours?: number | null;
  formatDate?: (iso: string) => string;
}): EntreeCondition[] {
  const entrees: EntreeCondition[] = [];
  const texte = (v: string | null | undefined) => (v ?? "").trim();

  if (texte(args.delaiIntervention)) {
    entrees.push({
      label: "Délai d'intervention",
      valeur: texte(args.delaiIntervention),
    });
  }
  if (args.dateDebutTravaux) {
    entrees.push({
      label: "Début prévu",
      valeur: args.formatDate
        ? args.formatDate(args.dateDebutTravaux)
        : args.dateDebutTravaux,
    });
  }
  if (args.dureeEstimeeJours && args.dureeEstimeeJours > 0) {
    entrees.push({
      label: "Durée estimée",
      valeur: `${args.dureeEstimeeJours} jour${args.dureeEstimeeJours > 1 ? "s" : ""}`,
    });
  }
  if (texte(args.fraisDeplacement)) {
    entrees.push({
      label: "Frais de déplacement",
      valeur: texte(args.fraisDeplacement),
    });
  }
  if (args.validiteJours && args.validiteJours > 0) {
    entrees.push({
      label: "Validité de l'offre",
      valeur: `${args.validiteJours} jours à compter de l'émission`,
    });
  }
  return entrees;
}

// ---------------------------------------------------------------------------
// Assurances (bloc affiché UNE fois, plus en pied de page répété)
// ---------------------------------------------------------------------------

export type EntreeAssurance = { titre: string; lignes: string[] };

/**
 * Bloc « ASSURANCES ET QUALIFICATIONS », construit depuis le profil
 * déjà renseigné. Chaque entrée n'apparaît que si son numéro existe —
 * aucune mention inventée.
 */
export function blocsAssurance(profil: {
  num_assurance_decennale?: string | null;
  assureur_decennale?: string | null;
  assureur_decennale_adresse?: string | null;
  zone_couverture_decennale?: string | null;
  num_attestation_fluides_frigo?: string | null;
  num_rge_qualipac?: string | null;
} | null): EntreeAssurance[] {
  if (!profil) return [];
  const blocs: EntreeAssurance[] = [];

  if (profil.num_assurance_decennale) {
    const lignes: string[] = [];
    const assureur = (profil.assureur_decennale ?? "").trim();
    lignes.push(
      assureur
        ? `${assureur} — police n° ${profil.num_assurance_decennale}`
        : `Police n° ${profil.num_assurance_decennale}`,
    );
    if (profil.assureur_decennale_adresse) {
      lignes.push(profil.assureur_decennale_adresse);
    }
    lignes.push(
      `Couverture : ${(profil.zone_couverture_decennale ?? "France métropolitaine").trim()}`,
    );
    blocs.push({ titre: "Assurance décennale", lignes });
  }

  if (profil.num_attestation_fluides_frigo) {
    blocs.push({
      titre: "Attestation de capacité fluides frigorigènes",
      lignes: [`N° ${profil.num_attestation_fluides_frigo}`],
    });
  }

  if (profil.num_rge_qualipac) {
    blocs.push({
      titre: "Qualification RGE QualiPAC",
      lignes: [`N° ${profil.num_rge_qualipac}`],
    });
  }

  return blocs;
}
