/**
 * Aide PostgREST : une saisie utilisateur interpolée dans un filtre
 * `.or("col.ilike.%…%")` peut casser l'arbre de filtres (virgule,
 * parenthèses) ou changer de colonne. On retire ces caractères et on
 * neutralise les jokers : la recherche reste littérale.
 */
export function motifIlike(saisie: string): string {
  const propre = saisie
    .replace(/[,()"\\]/g, " ")
    .replace(/[%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `%${propre}%`;
}
