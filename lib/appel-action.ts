/**
 * Appel d'une Server Action depuis le navigateur, avec le réseau du
 * chantier en tête : si l'appel REJETTE (pas de réseau, sous-sol,
 * serveur injoignable), on renvoie un résultat `{ ok: false }` au lieu
 * d'une promesse non gérée — l'écran peut alors annuler son changement
 * optimiste et prévenir, au lieu de laisser croire que c'est enregistré.
 */
import type { TypeEntree } from "@/lib/file-attente-helpers";

export type ResultatAction<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const MESSAGE_HORS_LIGNE =
  "Pas de réseau : la modification n'a pas été enregistrée. Réessayez quand la connexion revient.";

/**
 * Comme appelerAction, mais si le réseau manque (avant ou pendant
 * l'appel), la modification est mise en FILE D'ATTENTE (lib/file-attente)
 * et partira au retour du réseau. L'appelant reçoit `enAttente: true`
 * pour l'annoncer et garder son affichage optimiste. `entree.id` est
 * l'identifiant que le serveur utilisera : rejouer n'en crée pas deux.
 */
export async function appelerOuMettreEnAttente<T>(
  entree: { id: string; type: TypeEntree; payload: Record<string, unknown> },
  appel: () => Promise<ResultatAction<T>>,
): Promise<ResultatAction<T> | { ok: true; enAttente: true }> {
  const horsLigne = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!horsLigne) {
    const res = await appelerAction(appel);
    if (res.ok || res.error !== MESSAGE_HORS_LIGNE) return res;
  }
  try {
    const { ajouterAFile } = await import("@/lib/file-attente");
    await ajouterAFile(entree.type, entree.payload, entree.id);
    return { ok: true, enAttente: true };
  } catch {
    return { ok: false, error: MESSAGE_HORS_LIGNE };
  }
}

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
