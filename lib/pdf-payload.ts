/**
 * LISTE BLANCHE des champs de ligne autorisés dans un document destiné
 * au client (PDF de devis/facture, pièce jointe email).
 *
 * Principe : on ne retire pas les champs sensibles, on ÉNUMÈRE les
 * champs autorisés — un futur champ privé ajouté aux tables de lignes
 * ne peut pas fuiter par oubli. `prix_achat_ttc_unitaire` et
 * `fournisseur` (coûts privés) ne figurent pas dans cette liste et ne
 * doivent JAMAIS y entrer. Testé dans pdf-payload.test.ts.
 */

export type LignePdf = {
  id: string;
  designation: string;
  quantite: number;
  prix_unitaire_ht: number;
  total_ht: number;
  nature_fiscale: string;
  type: string;
  ordre: number;
};

/**
 * Caractères hors WinAnsi (police Helvetica standard, sans police
 * Unicode embarquée) : un emoji tapé depuis l'iPhone dans une
 * désignation, ou → ≥ Ω, s'imprimait en glyphes parasites. On
 * remplace ce qui a un équivalent lisible et on retire le reste.
 */
const REMPLACEMENTS_PDF: Array<[RegExp, string]> = [
  [/[\u2192\u27A1]/g, "->"],
  [/\u2190/g, "<-"],
  [/\u2265/g, ">="],
  [/\u2264/g, "<="],
  [/\u2260/g, "!="],
  [/\u2212/g, "-"],
  [/\u03A9/g, "Ohm"],
  [/\u00A0|\u202F/g, " "],
  [/\u2713|\u2714|\u2705/g, "OK"],
];
const AUTORISE_PDF = /[\u0020-\u00FF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018-\u201E\u2020-\u2022\u2026\u2030\u2039\u203A\u20AC\u2122\n\t]/;

export function nettoyerTextePdf(texte: string | null | undefined): string {
  if (!texte) return "";
  let t = texte;
  for (const [motif, rempl] of REMPLACEMENTS_PDF) t = t.replace(motif, rempl);
  let sortie = "";
  for (const ch of t) if (AUTORISE_PDF.test(ch)) sortie += ch;
  return sortie.replace(/[ ]{2,}/g, " ").trim();
}

/**
 * Épure des lignes de document avant tout rendu destiné au client.
 * Accepte les Row complets de devis_lignes / factures_lignes et ne
 * laisse passer que la liste blanche ci-dessus.
 */
export function payloadLignesPdf(
  lignes: Array<{
    id: string;
    designation: string;
    quantite: number;
    prix_unitaire_ht: number;
    total_ht: number;
    nature_fiscale: string;
    type: string;
    ordre: number;
  }>,
): LignePdf[] {
  return lignes.map((l) => ({
    id: l.id,
    designation: nettoyerTextePdf(l.designation),
    quantite: l.quantite,
    prix_unitaire_ht: l.prix_unitaire_ht,
    total_ht: l.total_ht,
    nature_fiscale: l.nature_fiscale,
    type: l.type,
    ordre: l.ordre,
  }));
}
