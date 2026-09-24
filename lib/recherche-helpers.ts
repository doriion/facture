/**
 * Helpers PURS de la recherche globale (Ctrl/⌘ K) — testés dans
 * recherche-helpers.test.ts. La server action (lib/actions/recherche)
 * interroge la base ; ici : normalisation de la saisie et mise à plat
 * des groupes pour la navigation au clavier.
 */

export type ResultatRecherche = {
  id: string;
  href: string;
  titre: string;
  sousTitre?: string | null;
  /** Étiquette courte (statut, date…) affichée à droite. */
  etiquette?: string | null;
};

export type GroupeRecherche = {
  cle: string;
  libelle: string;
  resultats: ResultatRecherche[];
};

export const LONGUEUR_MIN_REQUETE = 2;
export const LONGUEUR_MAX_REQUETE = 80;

/**
 * Saisie → requête exploitable : espaces réduits, longueur bornée.
 * `null` si trop courte (on n'interroge pas la base pour une lettre).
 */
export function normaliserRequete(saisie: string): string | null {
  const propre = saisie.replace(/\s+/g, " ").trim().slice(0, LONGUEUR_MAX_REQUETE);
  return propre.length >= LONGUEUR_MIN_REQUETE ? propre : null;
}

/** Liste plate (dans l'ordre d'affichage) pour ↑ ↓ Entrée. */
export function aplatirGroupes(groupes: GroupeRecherche[]): ResultatRecherche[] {
  const plat: ResultatRecherche[] = [];
  for (const g of groupes) for (const r of g.resultats) plat.push(r);
  return plat;
}

/** Index suivant/précédent en boucle (−1 = aucune sélection). */
export function deplacerSelection(
  index: number,
  total: number,
  sens: 1 | -1,
): number {
  if (total <= 0) return -1;
  if (index < 0) return sens === 1 ? 0 : total - 1;
  return (index + sens + total) % total;
}

/** Groupes non vides uniquement, total des résultats. */
export function resumerGroupes(groupes: GroupeRecherche[]): {
  groupes: GroupeRecherche[];
  total: number;
} {
  const pleins = groupes.filter((g) => g.resultats.length > 0);
  return { groupes: pleins, total: pleins.reduce((s, g) => s + g.resultats.length, 0) };
}
