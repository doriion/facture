/**
 * Partage, au sein d'une même requête, la réponse de `auth.getUser()`
 * entre toutes les actions qui l'appellent (logique pure, testée).
 *
 * - Un JWT explicite n'est jamais partagé (usage hors session).
 * - Une réponse SANS utilisateur (session expirée, erreur réseau) n'est
 *   pas mémorisée : l'appel suivant réinterroge Supabase Auth.
 */
type ReponseUser = { data: { user: unknown | null }; error: unknown };

export function memoriserGetUser<T extends ReponseUser>(
  original: (jwt?: string) => Promise<T>,
): (jwt?: string) => Promise<T> {
  let enCours: Promise<T> | null = null;
  return (jwt?: string) => {
    if (jwt) return original(jwt);
    if (!enCours) {
      const promesse = original().then(
        (res) => {
          if (!res.data.user) enCours = null;
          return res;
        },
        (err) => {
          enCours = null;
          throw err;
        },
      );
      enCours = promesse;
    }
    return enCours;
  };
}
