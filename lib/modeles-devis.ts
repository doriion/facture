/**
 * Logique PURE des modèles de devis nommés — aucune I/O, testée dans
 * modeles-devis.test.ts. Les server actions et les composants ne font
 * qu'appliquer ces règles.
 *
 * Un modèle est un devis (est_modele = true) qui porte, en plus, un
 * nom lisible (devis.nom_modele) : « Pose monosplit », « Entretien
 * PAC »… Les modèles créés avant l'arrivée du nom n'en ont pas
 * (NULL) : ils s'affichent par leur numéro tant qu'ils ne sont pas
 * renommés.
 */

/** Longueur maximale du nom — la même que la contrainte CHECK en base. */
export const NOM_MODELE_MAX = 80;

export type ResultatNomModele =
  | { ok: true; nom: string }
  | { ok: false; error: string };

/**
 * Nettoie et valide un nom saisi : espaces rognés et dédoublés, vide
 * refusé, longueur bornée. Le message d'erreur est directement
 * affichable dans le formulaire.
 */
export function normaliserNomModele(saisie: unknown): ResultatNomModele {
  const nom = String(saisie ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (nom.length === 0) {
    return { ok: false, error: "Donnez un nom au modèle (ex. « Pose monosplit »)." };
  }
  if (nom.length > NOM_MODELE_MAX) {
    return {
      ok: false,
      error: `Le nom du modèle ne doit pas dépasser ${NOM_MODELE_MAX} caractères.`,
    };
  }
  return { ok: true, nom };
}

export type ModeleNommable = {
  numero: string;
  nom_modele?: string | null;
};

/** Nom affiché partout : le nom choisi, sinon le numéro du devis. */
export function nomModeleAffiche(modele: ModeleNommable): string {
  const nom = modele.nom_modele?.trim();
  return nom ? nom : `Modèle ${modele.numero}`;
}

/** Le modèle a-t-il encore besoin d'être nommé ? */
export function modeleSansNom(modele: ModeleNommable): boolean {
  return !modele.nom_modele?.trim();
}

/**
 * Ordre d'affichage : alphabétique sur le nom affiché (insensible à la
 * casse et aux accents), les modèles pas encore nommés en dernier —
 * ils se distinguent moins bien et méritent d'être renommés.
 */
export function trierModeles<T extends ModeleNommable>(modeles: T[]): T[] {
  const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
  return [...modeles].sort((a, b) => {
    const aSansNom = modeleSansNom(a);
    const bSansNom = modeleSansNom(b);
    if (aSansNom !== bSansNom) return aSansNom ? 1 : -1;
    return collator.compare(nomModeleAffiche(a), nomModeleAffiche(b));
  });
}
