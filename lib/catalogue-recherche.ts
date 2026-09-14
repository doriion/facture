/**
 * Recherche dans le catalogue pour l'auto-complétion des lignes de
 * devis et de factures. Logique PURE, testée dans
 * catalogue-recherche.test.ts : le composant ne fait qu'afficher ce
 * que ces fonctions renvoient.
 *
 * Objectif : taper deux ou trois lettres et voir remonter la bonne
 * prestation sans réfléchir. Le classement compte donc autant que le
 * filtrage — une liste juste mais mal ordonnée oblige à lire, et lire
 * coûte plus cher que taper une lettre de plus.
 */

/** Nombre de caractères à partir duquel on propose quelque chose. */
export const MIN_CARACTERES_SUGGESTION = 2;

/** Au-delà, la liste devient un catalogue à lire plutôt qu'un raccourci. */
export const MAX_SUGGESTIONS = 8;

export type PrestationCatalogue = {
  id: string;
  designation: string;
  description?: string | null;
  prix_ht: number | string;
  prix_achat_ttc?: number | string | null;
  fournisseur?: string | null;
  unite?: string | null;
  categorie?: string | null;
  nature_fiscale?: string | null;
  actif?: boolean | null;
};

/**
 * Forme comparable d'un texte : minuscules, sans accents, sans
 * ponctuation, espaces normalisés.
 *
 * Les ligatures sont traitées AVANT la décomposition NFD, qui ne les
 * décompose pas : sans ça « main d'œuvre » ne se trouve pas en tapant
 * « oeuvre ». Même raison pour les apostrophes typographiques, que le
 * clavier ne produit pas.
 */
export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[’‘‛`]/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

/** Les mots d'un texte normalisé, sans les vides. */
function mots(texte: string): string[] {
  return texte.split(" ").filter(Boolean);
}

/**
 * Score d'une prestation face à la saisie. Plus c'est bas, plus c'est
 * pertinent ; `null` quand ça ne correspond pas du tout.
 *
 * Trois niveaux, du plus au moins évident pour l'utilisateur :
 *   0 — la désignation commence par ce qui est tapé ;
 *   1 — un MOT de la désignation commence par ce qui est tapé
 *       (« chaudière » trouvé en tapant « chau » dans « Pose
 *       chaudière ») ;
 *   2 — c'est présent quelque part, désignation ou description.
 *
 * Une saisie de plusieurs mots doit correspondre mot à mot : taper
 * « pose chaud » trouve « Pose de chaudière », alors qu'une simple
 * recherche de sous-chaîne ne trouverait rien à cause du « de ».
 */
export function scorePrestation(
  prestation: PrestationCatalogue,
  saisie: string,
): number | null {
  const q = normaliser(saisie);
  if (!q) return null;

  const designation = normaliser(prestation.designation ?? "");
  const description = normaliser(prestation.description ?? "");
  const motsSaisis = mots(q);
  const motsDesignation = mots(designation);

  if (designation.startsWith(q)) return 0;

  // Chaque mot tapé doit être le début d'un mot de la désignation.
  const tousEnDebutDeMot = motsSaisis.every((m) =>
    motsDesignation.some((d) => d.startsWith(m)),
  );
  if (tousEnDebutDeMot) return 1;

  const tousPresents = motsSaisis.every(
    (m) => designation.includes(m) || description.includes(m),
  );
  return tousPresents ? 2 : null;
}

/**
 * Les prestations à proposer, classées. Les archivées sont écartées :
 * elles ont été rangées exprès, les reproposer annulerait le geste.
 *
 * Sous le seuil de caractères, on ne renvoie rien plutôt que tout le
 * catalogue : une liste qui s'ouvre dès la première lettre gêne la
 * frappe au lieu de l'aider.
 */
export function chercherPrestations(
  catalogue: PrestationCatalogue[],
  saisie: string,
  options?: { limite?: number },
): PrestationCatalogue[] {
  const q = (saisie ?? "").trim();
  if (normaliser(q).length < MIN_CARACTERES_SUGGESTION) return [];

  const limite = options?.limite ?? MAX_SUGGESTIONS;

  return catalogue
    .filter((p) => p.actif !== false)
    .map((p) => ({ p, score: scorePrestation(p, q) }))
    .filter((x): x is { p: PrestationCatalogue; score: number } =>
      x.score !== null,
    )
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.p.designation.localeCompare(b.p.designation, "fr"),
    )
    .slice(0, limite)
    .map((x) => x.p);
}

/**
 * Déplacement dans la liste au clavier. La sélection tourne en boucle
 * (le bas ramène en haut) pour ne jamais coincer la main sur une
 * flèche qui ne fait plus rien.
 *
 * `-1` signifie « rien de sélectionné » et n'est jamais renvoyé quand
 * la liste n'est pas vide : la première flèche choisit toujours.
 */
export function indexSuivant(
  indexActuel: number,
  nbElements: number,
  direction: 1 | -1,
): number {
  if (nbElements <= 0) return -1;
  if (indexActuel < 0) return direction === 1 ? 0 : nbElements - 1;
  return (indexActuel + direction + nbElements) % nbElements;
}

/**
 * Valeurs qu'une prestation dépose dans la ligne. La description
 * complète la désignation, comme le fait déjà l'ajout depuis le
 * sélecteur du catalogue — même prestation, même libellé, que la
 * ligne vienne de l'un ou de l'autre.
 *
 * La quantité n'est PAS touchée : elle est propre au chantier, et
 * l'écraser ferait perdre une saisie déjà faite.
 */
export function ligneDepuisPrestation(prestation: PrestationCatalogue): {
  designation: string;
  prix_unitaire_ht: number;
  prix_achat_ttc_unitaire: number | null;
  fournisseur: string;
  nature_fiscale: string;
} {
  const description = (prestation.description ?? "").trim();
  const designation = description
    ? `${prestation.designation} — ${description}`
    : prestation.designation;

  const pa = prestation.prix_achat_ttc;
  return {
    designation,
    prix_unitaire_ht: Number(prestation.prix_ht) || 0,
    prix_achat_ttc_unitaire:
      pa === null || pa === undefined || pa === "" ? null : Number(pa),
    fournisseur: prestation.fournisseur ?? "",
    nature_fiscale: prestation.nature_fiscale ?? "bic_prestations",
  };
}

/**
 * Une ligne mérite-t-elle le bouton « Ajouter au catalogue » ?
 *
 * Non si elle est vide, non si c'est un titre de section, et non si
 * la désignation existe déjà au catalogue — sinon le bouton propose
 * de créer un doublon, et un catalogue plein de doublons se cherche
 * plus mal qu'un catalogue vide.
 *
 * La comparaison est normalisée : « Pose chaudière » et « pose
 * chaudiere » sont la même prestation.
 */
export function ligneAbsenteDuCatalogue(
  ligne: { designation?: string | null; type?: string | null },
  catalogue: PrestationCatalogue[],
): boolean {
  if (ligne.type === "titre") return false;
  const d = normaliser(ligne.designation ?? "");
  if (!d) return false;
  return !catalogue.some((p) => {
    const description = (p.description ?? "").trim();
    const complet = description
      ? `${p.designation} — ${description}`
      : p.designation;
    return normaliser(p.designation) === d || normaliser(complet) === d;
  });
}
