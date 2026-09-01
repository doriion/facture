import "server-only";

/**
 * Protection des routes /api/cron/* : Vercel Cron ajoute
 * `Authorization: Bearer ${CRON_SECRET}` à ses appels quand la
 * variable d'environnement CRON_SECRET est définie sur le projet.
 * Toute requête sans ce secret exact est refusée — y compris quand la
 * variable n'est pas configurée (on refuse TOUT plutôt que d'exposer
 * la route).
 *
 * Variable Vercel requise : CRON_SECRET (une chaîne aléatoire longue,
 * ex. `openssl rand -hex 32`), en Production ET Preview, AVANT le
 * merge.
 */
export function estAppelCronAutorise(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
