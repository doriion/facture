/**
 * Mentions calculées du devis — helpers PURS (testés).
 */

import { formatEuros, round2 } from "@/lib/format";

// formatEuros remplace les espaces insécables par des espaces simples :
// indispensable pour le PDF (Helvetica WinAnsi rend U+202F en « / »).
function euros(n: number): string {
  return formatEuros(n);
}

/**
 * Mention d'acompte du devis :
 * - % renseigné (prioritaire) → « Acompte à la commande : 30 % (1 350,00 €),
 *   solde à réception de facture. »
 * - montant seul → « Acompte à la commande : 500,00 €, solde à
 *   réception de facture. »
 * - rien → null (pas de mention).
 */
export function mentionAcompte(
  totalHt: number,
  acomptePct: number | null | undefined,
  acompteMontant: number | null | undefined,
): string | null {
  const acompte = acompteDevis(totalHt, acomptePct, acompteMontant);
  if (!acompte) return null;
  return acompte.pct !== null
    ? `Acompte à la commande : ${acompte.pctAffiche} % (${euros(acompte.montant)}), solde à réception de facture.`
    : `Acompte à la commande : ${euros(acompte.montant)}, solde à réception de facture.`;
}

/**
 * Acompte demandé par le devis (le % prime sur le montant fixe) :
 * montant arrondi au centime, pourcentage affiché à la française, et
 * texte court pour un e-mail (« 1 350,00 € (30 %) » ou « 500,00 € »).
 * null sans acompte (valeurs nulles ou zéro).
 */
export function acompteDevis(
  totalHt: number,
  acomptePct: number | null | undefined,
  acompteMontant: number | null | undefined,
): { montant: number; pct: number | null; pctAffiche: string | null; texte: string } | null {
  if (acomptePct !== null && acomptePct !== undefined && acomptePct > 0) {
    const montant = round2((totalHt * acomptePct) / 100);
    const pctAffiche = Number.isInteger(acomptePct)
      ? String(acomptePct)
      : acomptePct.toLocaleString("fr-FR");
    return { montant, pct: acomptePct, pctAffiche, texte: `${euros(montant)} (${pctAffiche} %)` };
  }
  if (acompteMontant !== null && acompteMontant !== undefined && acompteMontant > 0) {
    const montant = round2(acompteMontant);
    return { montant, pct: null, pctAffiche: null, texte: euros(montant) };
  }
  return null;
}
