/**
 * Helpers PURS de la sauvegarde automatique (testés).
 */

/** Nom de fichier stable par jour → relancer le même jour écrase (idempotent). */
export function nomFichierSauvegarde(dateIso: string): string {
  return `sauvegarde-facture-ae-${dateIso}.json`;
}

/**
 * Rotation : parmi des noms de fichiers datés (triables
 * lexicographiquement), renvoie ceux à SUPPRIMER pour n'en garder que
 * `garder` (les plus récents). Ne touche jamais aux fichiers dont le
 * nom ne matche pas le motif de sauvegarde (prudence : on ne supprime
 * que ce qu'on a soi-même créé).
 */
export function sauvegardesASupprimer(
  noms: string[],
  garder = 12,
): string[] {
  const motif = /^sauvegarde-facture-ae-\d{4}-\d{2}-\d{2}\.json$/;
  const datees = noms.filter((n) => motif.test(n)).sort().reverse();
  return datees.slice(Math.max(0, garder));
}
