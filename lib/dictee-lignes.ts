/**
 * Dictée (ou texte collé) → lignes de devis / facture, logique PURE testée.
 *
 * « deux heures de main d'œuvre, un ballon 200 litres et 3 mètres de
 * cuivre » devient trois lignes : la quantité est lue en tête de
 * chaque segment (chiffres ou mots), le reste est cherché dans le
 * catalogue par recouvrement de mots ; sans correspondance nette, la
 * ligne est créée libre (désignation dictée, prix à saisir).
 */

import { ligneDepuisPrestation, normaliser, type PrestationCatalogue } from "@/lib/catalogue-recherche";

export type LigneDictee = {
  designation: string;
  quantite: number;
  prix_unitaire_ht: number | "";
  prix_achat_ttc_unitaire: number | null;
  fournisseur: string;
  nature_fiscale: string;
  /** Prestation du catalogue reconnue (null = ligne libre). */
  prestation: PrestationCatalogue | null;
  /** Segment dicté d'origine, pour l'affichage. */
  texte: string;
};

const NOMBRES: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50, cent: 100,
};

const MOTS_VIDES = new Set([
  "de", "du", "des", "la", "le", "les", "l", "d", "un", "une", "et", "en", "a", "au", "aux", "pour", "avec", "sur", "par", "the",
  "fois", "x", "lot", "lots", "unite", "unites", "piece", "pieces",
]);

/** Découpe le texte en segments (virgule, point-virgule, retour à la ligne, « et », « puis », « plus »). */
export function segmentsDictee(texte: string): string[] {
  return texte
    .replace(/\r/g, "")
    .split(/\n|[;,]|\s+(?:et puis|puis|et|plus|ensuite)\s+/i)
    .map((s) => s.trim().replace(/^[\-–•*]\s*/, ""))
    .filter((s) => s.length > 0);
}

/** Quantité en tête (« 2 », « 2,5 », « deux », « 3 x », « x3 ») et reste du segment. */
export function extraireQuantite(segment: string): { quantite: number; reste: string } {
  const s = segment.trim();
  let m = /^(\d+(?:[.,]\d+)?)\s*(?:x|×|fois)?\s*(.*)$/i.exec(s);
  if (m && m[2] !== undefined) return { quantite: Number(m[1]!.replace(",", ".")), reste: m[2]!.trim() };
  m = /^x\s*(\d+(?:[.,]\d+)?)\s*(.*)$/i.exec(s);
  if (m) return { quantite: Number(m[1]!.replace(",", ".")), reste: m[2]!.trim() };
  const premierMot = /^([a-zéèêA-ZÉ]+)\s+(.*)$/.exec(s);
  if (premierMot) {
    const n = NOMBRES[normaliser(premierMot[1]!)];
    if (n !== undefined && premierMot[2]!.length > 0) return { quantite: n, reste: premierMot[2]!.trim() };
  }
  // « 3 mètres de cuivre » déjà traité ; « cuivre 3 m » : quantité en fin
  m = /^(.*?)\s+(\d+(?:[.,]\d+)?)\s*(m|ml|m2|m²|h|heures?|kg|l|litres?|pcs?|u)?$/i.exec(s);
  if (m && m[1]!.length > 0 && m[3]) return { quantite: Number(m[2]!.replace(",", ".")), reste: `${m[1]} (${m[3]})`.trim() };
  return { quantite: 1, reste: s };
}

function motsUtiles(texte: string): string[] {
  return normaliser(texte)
    .split(" ")
    .filter((m) => m.length >= 2 && !MOTS_VIDES.has(m));
}

/** Un mot dicté « correspond » à un mot du catalogue s'il en est le début (≥ 4 lettres) ou l'égal. */
function motCorrespond(dicte: string, cata: string): boolean {
  if (dicte === cata) return true;
  return dicte.length >= 4 && (cata.startsWith(dicte) || dicte.startsWith(cata));
}

/**
 * Meilleure prestation pour un texte : part des mots utiles dictés
 * retrouvés dans la désignation (ou la description, moins bien
 * notée). Il faut au moins la moitié des mots, et un mot entier.
 */
export function meilleurePrestation(texte: string, catalogue: PrestationCatalogue[]): PrestationCatalogue | null {
  const mots = motsUtiles(texte);
  if (mots.length === 0) return null;
  let meilleure: { p: PrestationCatalogue; score: number } | null = null;
  for (const p of catalogue) {
    if (p.actif === false) continue;
    const motsDesignation = motsUtiles(p.designation ?? "");
    const motsDescription = motsUtiles(p.description ?? "");
    let score = 0;
    for (const m of mots) {
      if (motsDesignation.some((d) => motCorrespond(m, d))) score += 1;
      else if (motsDescription.some((d) => motCorrespond(m, d))) score += 0.5;
    }
    // Pénalise une désignation beaucoup plus longue que ce qui est dit
    // (« pose » seul ne doit pas choisir « Pose complète PAC air/eau »).
    const ratio = score / mots.length;
    const precision = score / Math.max(1, motsDesignation.length);
    const total = ratio + precision * 0.5;
    if (ratio >= 0.5 && score >= 1 && (!meilleure || total > meilleure.score)) meilleure = { p, score: total };
  }
  return meilleure?.p ?? null;
}

/** Texte dicté complet → lignes prêtes pour l'éditeur. */
export function lignesDepuisDictee(texte: string, catalogue: PrestationCatalogue[]): LigneDictee[] {
  return segmentsDictee(texte).map((segment) => {
    const { quantite, reste } = extraireQuantite(segment);
    const prestation = meilleurePrestation(reste, catalogue);
    if (prestation) {
      const l = ligneDepuisPrestation(prestation);
      return { ...l, quantite, prestation, texte: segment };
    }
    const designation = reste.charAt(0).toUpperCase() + reste.slice(1);
    return {
      designation,
      quantite,
      prix_unitaire_ht: "",
      prix_achat_ttc_unitaire: null,
      fournisseur: "",
      nature_fiscale: "bic_prestations",
      prestation: null,
      texte: segment,
    };
  });
}
