/**
 * Helpers PURS pour les relances de factures impayées (pas de
 * "use server", aucun accès base — testables unitairement).
 */

const JOUR_MS = 24 * 3600 * 1000;

/**
 * Nombre de jours de retard d'une facture : jours entiers écoulés
 * entre la date d'échéance et aujourd'hui (dates YYYY-MM-DD).
 * 0 le jour de l'échéance, négatif si l'échéance est future.
 */
export function joursDeRetard(dateEcheance: string, today: string): number {
  return Math.floor((Date.parse(today) - Date.parse(dateEcheance)) / JOUR_MS);
}

/**
 * Une facture est relançable si elle est « envoyée » (impayée, statut
 * "retard" n'étant jamais persisté — il est dérivé à l'affichage) et
 * que son échéance est strictement dépassée.
 */
export function estEnRetard(
  statut: string,
  dateEcheance: string | null | undefined,
  today: string,
): boolean {
  return statut === "envoyee" && Boolean(dateEcheance) && dateEcheance! < today;
}
