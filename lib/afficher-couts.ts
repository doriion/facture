/**
 * Toggle « Afficher mes coûts » — PRIVÉ, masqué par défaut, partagé
 * entre l'éditeur de lignes et le catalogue pour que l'état suive
 * l'utilisateur d'un écran à l'autre.
 *
 * L'état vit uniquement dans le navigateur (localStorage) : il ne
 * pilote QUE l'affichage. Les valeurs saisies restent enregistrées,
 * toggle éteint ou allumé, et ne quittent jamais les surfaces privées.
 */

export const CLE_AFFICHER_COUTS = "facture-ae:afficher-couts";

/** Lecture tolérante (mode privé, stockage bloqué → masqué). */
export function lireAfficherCouts(): boolean {
  try {
    return localStorage.getItem(CLE_AFFICHER_COUTS) === "1";
  } catch {
    return false;
  }
}

/** Écriture tolérante : l'échec de persistance ne casse rien. */
export function ecrireAfficherCouts(valeur: boolean): void {
  try {
    localStorage.setItem(CLE_AFFICHER_COUTS, valeur ? "1" : "0");
  } catch {
    // tant pis pour la persistance
  }
}
