/**
 * Mentions calculées du devis — helpers PURS (testés).
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function euros(n: number): string {
  return `${n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
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
  if (acomptePct !== null && acomptePct !== undefined && acomptePct > 0) {
    const montant = round2((totalHt * acomptePct) / 100);
    const pctAffiche = Number.isInteger(acomptePct)
      ? String(acomptePct)
      : acomptePct.toLocaleString("fr-FR");
    return `Acompte à la commande : ${pctAffiche} % (${euros(montant)}), solde à réception de facture.`;
  }
  if (
    acompteMontant !== null &&
    acompteMontant !== undefined &&
    acompteMontant > 0
  ) {
    return `Acompte à la commande : ${euros(round2(acompteMontant))}, solde à réception de facture.`;
  }
  return null;
}
