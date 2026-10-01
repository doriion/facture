/**
 * Identité transmise du middleware au rendu : le middleware a DÉJÀ
 * validé le JWT auprès de Supabase Auth (getUser) pour chaque
 * navigation ; le layout lisait une seconde fois le même service.
 * L'identité passe par un en-tête interne de requête, posé par le
 * middleware seul (toute valeur venant du client est effacée avant).
 * La RLS reste la garantie sur les données. Logique pure, testée.
 */

export const EN_TETE_UTILISATEUR = "x-ng-utilisateur";

export type UtilisateurTransmis = { id: string; email: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valeur d'en-tête (ASCII, encodée) pour un utilisateur validé. */
export function encoderUtilisateur(u: UtilisateurTransmis): string {
  return encodeURIComponent(JSON.stringify({ id: u.id, email: u.email }));
}

/** Relit l'en-tête ; null si absent ou mal formé (le rendu refait alors getUser). */
export function lireUtilisateurTransmis(valeur: string | null | undefined): UtilisateurTransmis | null {
  if (!valeur) return null;
  try {
    const u = JSON.parse(decodeURIComponent(valeur)) as { id?: unknown; email?: unknown };
    if (typeof u.id !== "string" || !UUID.test(u.id)) return null;
    return { id: u.id, email: typeof u.email === "string" ? u.email : "" };
  } catch {
    return null;
  }
}
