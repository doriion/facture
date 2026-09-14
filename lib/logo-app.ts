import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Logo de repli pour les PDF, lu dans `public/logo.png`.
 *
 * Le logo qui fait autorité sur un document reste celui déposé dans
 * Paramètres : c'est celui de l'entreprise, il est archivé avec le
 * profil et peut changer sans redéploiement. Ce repli sert quand rien
 * n'a encore été déposé — sans lui, les documents sortaient sans
 * aucune marque.
 *
 * Le fichier est lu une seule fois puis gardé en mémoire : un PDF est
 * généré à chaque téléchargement, et relire l'image à chaque fois
 * coûterait un accès disque pour un contenu qui ne change qu'au
 * déploiement.
 *
 * Absence de fichier = pas de logo, jamais une erreur : une charte
 * graphique incomplète ne doit pas empêcher d'émettre une facture.
 */
let cache: string | null | undefined;

export async function logoApplication(): Promise<string | null> {
  if (cache !== undefined) return cache;
  try {
    const buf = await readFile(join(process.cwd(), "public", "logo.png"));
    cache = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    cache = null;
  }
  return cache;
}

/** Réinitialise le cache — utile aux tests uniquement. */
export function oublierLogoApplication(): void {
  cache = undefined;
}
