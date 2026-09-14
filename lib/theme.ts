/**
 * PALETTE DE MARQUE — source unique des couleurs de l'application.
 *
 * Couleurs relevées sur le logo (vagues bleues). Avant ce module, la
 * couleur primaire était recopiée à l'identique dans chaque composant
 * PDF et dans les e-mails : une charte graphique se changeait alors en
 * huit endroits, et un oubli passait inaperçu jusqu'à ce qu'un client
 * reçoive un document aux mauvaises couleurs.
 *
 * L'INTERFACE WEB ne lit PAS ce fichier : elle passe par les variables
 * CSS de app/globals.css, que Tailwind consomme. Les valeurs y sont
 * les mêmes, exprimées en HSL, et un test (theme.test.ts) vérifie
 * qu'elles ne divergent pas.
 *
 * CONTRASTES (WCAG 2.1, calculés et vérifiés par theme.test.ts) :
 *
 *   MARINE     9,40:1 sur blanc — AAA. Texte fort, liens, titres.
 *   PRINCIPAL  5,43:1 sur blanc — AA.  Boutons (texte blanc), titres.
 *   SIGNATURE  3,17:1 sur blanc — gros texte uniquement.
 *   ACCENT     2,42:1 sur blanc — DÉCOR SEULEMENT, jamais du texte.
 *   CLAIR      1,32:1 sur blanc — FOND SEULEMENT, jamais du texte.
 *
 * Sur un fond CLAIR, écrire en MARINE (7,15:1, AAA) ou en TEXTE.
 * Ne jamais écrire en SIGNATURE, ACCENT ou CLAIR sur du blanc.
 */

/** Bleu marine — le plus contrasté. Texte fort, liens, titres de PDF. */
export const MARINE = "#003DA8";

/** Bleu principal — boutons, filets, en-têtes. Texte blanc dessus. */
export const PRINCIPAL = "#0165D9";

/** Bleu signature — couleur dominante du logo. Décor et gros texte. */
export const SIGNATURE = "#0194FB";

/** Bleu accent — survols, séries de graphique. Jamais du texte. */
export const ACCENT = "#00B1FC";

/** Bleu clair — fonds de badge et d'encadré. Jamais du texte. */
export const CLAIR = "#98EEFB";

/** Fond très pâle pour les encadrés d'un document. */
export const FOND_PALE = "#F2FAFF";

/** Bordure bleutée discrète, pour séparer sans alourdir. */
export const BORDURE_BLEUE = "#CFE6FB";

/* --- Neutres partagés par les documents ------------------------------ */

/** Texte courant des PDF. */
export const TEXTE = "#1c1f24";
/** Texte secondaire des PDF (mentions, libellés). */
export const TEXTE_DOUX = "#6b7280";
/** Filets et bordures neutres. */
export const BORDURE = "#e5e7eb";
/** Fond de bandeau neutre (en-têtes de tableau). */
export const FOND_NEUTRE = "#f6f7f9";

/**
 * Palette des graphiques du tableau de bord, dans l'ordre des séries.
 *
 * Les trois premières sont les bleus de la marque, du plus foncé au
 * plus clair, pour que les séries principales restent distinguables
 * même imprimées en noir et blanc. Les suivantes sont des teintes
 * franchement différentes : une série se lit d'abord par sa position
 * dans la légende, mais deux bleus voisins deviennent indiscernables
 * au-delà de trois ou quatre parts.
 */
export const COULEURS_GRAPHIQUES = [
  MARINE,
  PRINCIPAL,
  ACCENT,
  "#7C3AED",
  "#E97132",
  "#A5A5A5",
] as const;

/**
 * Vert conservé pour les états de SUCCÈS uniquement (encaissé, payé,
 * fait). Ce n'est plus une couleur de marque : c'est un signal, et le
 * remplacer par du bleu ferait perdre la lecture immédiate d'une liste
 * de factures. Décision prise avec l'utilisateur le 14/09/2026.
 */
export const SUCCES = "#15803d";
