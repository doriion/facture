/**
 * Vignettes des photos (chantier, tâches) : une version réduite est
 * produite sur le téléphone à l'envoi et rangée à côté de l'originale
 * (« …-min.jpg »). Les grilles affichent la vignette, l'originale ne
 * se charge qu'en plein écran. Logique pure, testée.
 */

/** Grand côté de la vignette, en pixels (carrés de 56 à 200 px à l'écran). */
export const TAILLE_VIGNETTE = 400;

/** Chemin de la vignette d'une photo : même dossier, suffixe -min, JPEG. */
export function cheminVignette(cheminPhoto: string): string {
  return `${cheminPhoto.replace(/\.[^./]+$/, "")}-min.jpg`;
}

/**
 * Associe à chaque photo son URL signée et celle de sa vignette (null
 * pour les photos d'avant les vignettes, ou si la signature a échoué).
 */
export function urlsPhotos(
  chemins: string[],
  signees: Array<{ path?: string | null; signedUrl?: string | null }>,
): Map<string, { url: string; urlMin: string | null }> {
  const parChemin = new Map<string, string>();
  for (const s of signees) if (s.path && s.signedUrl) parChemin.set(s.path, s.signedUrl);
  const resultat = new Map<string, { url: string; urlMin: string | null }>();
  for (const c of chemins) {
    resultat.set(c, { url: parChemin.get(c) ?? "", urlMin: parChemin.get(cheminVignette(c)) ?? null });
  }
  return resultat;
}
