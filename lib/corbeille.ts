/**
 * Corbeille des interventions — logique PURE, testée dans corbeille.test.ts.
 * Une intervention supprimée depuis l'app n'est pas effacée : elle porte
 * `supprime_le` et se restaure d'un clic.
 */

export function estDansCorbeille(i: { supprime_le?: string | null }): boolean {
  return Boolean(i.supprime_le);
}

/** « à l'instant », « il y a 3 h », « il y a 2 jours » — depuis la mise à la corbeille. */
export function ageCorbeille(supprime_le: string, maintenant: number = Date.now()): string {
  const ecart = Math.max(0, maintenant - new Date(supprime_le).getTime());
  const minutes = Math.floor(ecart / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  return jours === 1 ? "hier" : `il y a ${jours} jours`;
}

/** Interventions en service seulement (les listes, l'agenda, les compteurs). */
export function sansCorbeille<T extends { supprime_le?: string | null }>(liste: T[]): T[] {
  return liste.filter((i) => !estDansCorbeille(i));
}
