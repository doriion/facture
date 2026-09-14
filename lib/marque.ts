/**
 * Nom visible de l'application.
 *
 * Il était recopié dans la barre latérale, la barre du haut, le menu
 * mobile, l'écran de connexion et la mise en page racine. Le changer
 * demandait de tous les retrouver — et d'en oublier un.
 *
 * NE CONCERNE QUE L'INTERFACE. Les documents (devis, factures,
 * contrats) portent « Nathan Geneve EI », qui est une mention légale
 * obligatoire et n'a rien à voir avec le nom du logiciel.
 */
export const NOM_APPLICATION = "NG Gestion";

/** Monogramme affiché tant qu'aucun logo n'est déposé. */
export const MONOGRAMME = "NG";

/** Titre d'onglet d'une page : « Devis — NG Gestion ». */
export function titrePage(section: string): string {
  return `${section} — ${NOM_APPLICATION}`;
}
