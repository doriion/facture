/**
 * Lecture d'une facture ou d'un ticket fournisseur (texte OCR) —
 * logique PURE, testée. On en tire les lignes qui portent un montant
 * (désignation, quantité, prix unitaire TTC) et le total TTC, pour
 * renseigner les prix d'achat des lignes d'un devis ou d'une facture.
 * Les lignes de totaux, TVA, remises et règlements sont écartées.
 */

import { normaliser } from "@/lib/catalogue-recherche";

export type LigneFournisseur = {
  designation: string;
  quantite: number;
  /** Prix unitaire TTC (montant de la ligne / quantité). */
  prixUnitaire: number;
  /** Montant lu sur la ligne. */
  montant: number;
  texte: string;
};

export type LectureFournisseur = {
  fournisseur: string | null;
  date: string | null;
  totalTtc: number | null;
  lignes: LigneFournisseur[];
};

const MONTANT_RE = /(?:^|\s|:)(-?\d{1,3}(?:[  .]\d{3})*(?:[.,]\d{2})|-?\d+[.,]\d{2})\s*(?:€|eur|euros?)?\s*$/i;
const MOTS_HORS_LIGNES = /\b(total|sous[- ]?total|tva|t\.v\.a|ht\b|ttc\b|net a payer|net à payer|a payer|à payer|remise|escompte|acompte|reglement|règlement|paiement|cb\b|carte|especes|espèces|rendu|monnaie|frais de port|port\b|eco[- ]?part|deee|arrondi|base|taux)\b/i;

export function lireMontant(brut: string): number | null {
  const t = brut.replace(/[  ]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** « x2 », « 2 x », « 2,5 », « Qté 3 », « 3 U » en tête ou en fin : quantité et reste. */
export function quantiteEtDesignation(texte: string): { quantite: number; designation: string } {
  let t = texte.trim();
  let m = /^(?:qt[eé]\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:x|×|u|pcs?|pièces?|pieces?|unit[eé]s?)?\s+(.+)$/i.exec(t);
  if (m && m[2]!.length > 2 && Number(m[1]!.replace(",", ".")) <= 999) return { quantite: Number(m[1]!.replace(",", ".")), designation: m[2]!.trim() };
  m = /^(.+?)\s+(?:x|×)\s*(\d+(?:[.,]\d+)?)\s*$/i.exec(t);
  if (m) return { quantite: Number(m[2]!.replace(",", ".")), designation: m[1]!.trim() };
  m = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:x|×|u|pcs?|pièces?|pieces?|unit[eé]s?|m|ml|m2|m²|kg|l)\s*$/i.exec(t);
  if (m) return { quantite: Number(m[2]!.replace(",", ".")), designation: m[1]!.trim() };
  t = t.replace(/\s{2,}/g, " ");
  return { quantite: 1, designation: t };
}

/**
 * Texte OCR → lignes chiffrées + total. Une ligne est retenue si elle
 * finit par un montant et porte un libellé lisible ; le total TTC est le
 * plus grand montant d'une ligne « total / net à payer / TTC ».
 */
export function parserFactureFournisseur(texte: string): LectureFournisseur {
  const lignes: LigneFournisseur[] = [];
  let totalTtc: number | null = null;
  let fournisseur: string | null = null;
  let date: string | null = null;

  const brutes = texte.split(/\r?\n/).map((l) => l.replace(/\t/g, " ").trim()).filter(Boolean);
  for (const [index, ligne] of brutes.entries()) {
    if (!date) {
      const d = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/.exec(ligne);
      if (d) {
        const an = Number(d[3]) < 100 ? 2000 + Number(d[3]) : Number(d[3]);
        date = `${an}-${d[2]!.padStart(2, "0")}-${d[1]!.padStart(2, "0")}`;
      }
    }
    if (!fournisseur && index < 4 && /\p{L}{3,}/u.test(ligne) && !MONTANT_RE.test(ligne) && !/\d{5}/.test(ligne)) {
      fournisseur = ligne.replace(/\s{2,}/g, " ").slice(0, 80);
    }
    const m = MONTANT_RE.exec(ligne);
    if (!m) continue;
    const montant = lireMontant(m[1]!);
    if (montant === null) continue;
    const avant = ligne.slice(0, m.index + (m[0].startsWith(":") ? 1 : 0)).replace(/[:\-–—|]+\s*$/, "").trim();
    if (MOTS_HORS_LIGNES.test(avant)) {
      if (/total|net|payer|ttc/i.test(avant) && montant > 0 && (totalTtc === null || montant > totalTtc)) totalTtc = montant;
      continue;
    }
    if (montant <= 0) continue;
    // Désignation : au moins deux lettres, montants intermédiaires (PU, qté) retirés de la fin.
    const sansChiffresFin = avant.replace(/(?:\s+-?\d+(?:[.,]\d+)?\s*(?:€|%)?)+$/g, "").trim();
    const { quantite, designation } = quantiteEtDesignation(sansChiffresFin);
    if (!/\p{L}{2}/u.test(designation) || normaliser(designation).length < 3) continue;
    const q = quantite > 0 ? quantite : 1;
    lignes.push({ designation, quantite: q, prixUnitaire: Math.round((montant / q) * 100) / 100, montant, texte: ligne });
  }
  return { fournisseur, date, totalTtc, lignes };
}

/** Recouvrement de mots (0..1) entre une ligne fournisseur et une ligne de document, pour proposer la correspondance. */
export function scoreCorrespondance(a: string, b: string): number {
  const ma = new Set(normaliser(a).split(" ").filter((m) => m.length >= 3));
  const mb = new Set(normaliser(b).split(" ").filter((m) => m.length >= 3));
  if (ma.size === 0 || mb.size === 0) return 0;
  let communs = 0;
  for (const m of ma) if (mb.has(m)) communs += 1;
  return communs / Math.min(ma.size, mb.size);
}
