/**
 * Helpers PURS pour le flux paiements ↔ statut de facture (pas de
 * "use server", aucun accès base — testables unitairement).
 *
 * C'est la logique utilisée par les server actions : marquer une
 * facture « payée » crée un paiement, et le statut découle toujours
 * des encaissements réellement enregistrés (cohérence avec les jauges
 * du dashboard et l'export URSSAF, tous deux basés sur la table
 * paiements).
 */

/** Tolérance d'arrondi : en dessous de 0,005 € on considère soldé. */
const EPSILON = 0.005;

export function arrondi2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Reste à encaisser sur une facture (jamais négatif, arrondi au centime).
 * Sert aussi de pré-remplissage du montant dans la fenêtre « Marquer payée ».
 */
export function montantRestant(
  totalFacture: number,
  totalEncaisse: number,
): number {
  return Math.max(0, arrondi2(totalFacture - totalEncaisse));
}

/** Une facture est soldée quand le reste dû est nul (à l'arrondi près). */
export function estSoldee(resteDu: number): boolean {
  return resteDu <= EPSILON;
}

/**
 * Statut après enregistrement d'un paiement : une facture envoyée (ou
 * encore en brouillon) passe « payée » dès qu'elle est soldée. Les
 * statuts annulée/payée ne bougent pas ; un paiement partiel non plus.
 */
export function statutApresEncaissement(
  statutActuel: string,
  resteDu: number,
): string {
  if (!estSoldee(resteDu)) return statutActuel;
  if (statutActuel === "envoyee" || statutActuel === "brouillon") {
    return "payee";
  }
  return statutActuel;
}

/**
 * Statut après suppression d'un paiement : une facture « payée » dont
 * le reste dû redevient positif repasse « envoyée ». Sinon inchangé.
 */
export function statutApresSuppressionPaiement(
  statutActuel: string,
  resteDu: number,
): string {
  if (statutActuel === "payee" && !estSoldee(resteDu)) return "envoyee";
  return statutActuel;
}
