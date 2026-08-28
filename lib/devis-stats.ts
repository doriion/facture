/**
 * Statistiques devis PURES (pas de "use server") — testées dans
 * lib/devis-stats.test.ts.
 */

/**
 * Taux d'acceptation des devis en % entier, ou null quand AUCUN devis
 * n'est « décidable » (envoyé, accepté ou refusé) : un 0 % sans
 * dénominateur est trompeur, l'UI affiche « — ». Les brouillons et
 * expirés ne comptent ni au numérateur ni au dénominateur.
 */
export function computeTauxConversionDevis(
  statuts: Array<{ statut: string }>,
): number | null {
  let accepte = 0;
  let decidables = 0;
  for (const d of statuts) {
    if (d.statut === "accepte") {
      accepte += 1;
      decidables += 1;
    } else if (d.statut === "refuse" || d.statut === "envoye") {
      decidables += 1;
    }
  }
  if (decidables === 0) return null;
  return Math.round((accepte / decidables) * 100);
}
