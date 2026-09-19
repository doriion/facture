/**
 * Appel d'une Server Action depuis le navigateur, avec le réseau du
 * chantier en tête : si l'appel REJETTE (pas de réseau, sous-sol,
 * serveur injoignable), on renvoie un résultat `{ ok: false }` au lieu
 * d'une promesse non gérée — l'écran peut alors annuler son changement
 * optimiste et prévenir, au lieu de laisser croire que c'est enregistré.
 */
export type ResultatAction<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const MESSAGE_HORS_LIGNE =
  "Pas de réseau : la modification n'a pas été enregistrée. Réessayez quand la connexion revient.";

export async function appelerAction<T>(
  appel: () => Promise<ResultatAction<T>>,
  horsLigne: () => boolean = () => typeof navigator !== "undefined" && navigator.onLine === false,
): Promise<ResultatAction<T>> {
  try {
    return await appel();
  } catch (e) {
    if (horsLigne()) return { ok: false, error: MESSAGE_HORS_LIGNE };
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: /fetch|network|réseau|Failed to fetch|Load failed/i.test(message)
        ? MESSAGE_HORS_LIGNE
        : `Erreur de connexion au serveur : la modification n'a pas été enregistrée (${message}).`,
    };
  }
}
