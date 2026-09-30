/**
 * Autorisation des routes /api/cron/* — logique PURE (testée).
 *
 * Deux déclencheurs légitimes, deux secrets :
 * - Vercel Cron ajoute `Authorization: Bearer CRON_SECRET` ;
 * - pg_cron (Supabase, via pg_net) envoie `Bearer PUSH_CRON_SECRET`
 *   (le secret déjà utilisé pour les rappels push).
 * Une route accepte l'un OU l'autre. Aucun secret configuré = tout est
 * refusé (on préfère une route morte à une route ouverte).
 */
import { timingSafeEqual } from "node:crypto";

/** Égalité en temps constant (usage pour un jeton bearer). */
function egalConstant(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function autorisationCron(
  enteteAuthorization: string | null,
  secrets: Array<string | undefined | null>,
): boolean {
  if (!enteteAuthorization) return false;
  const valides = secrets.filter((s): s is string => Boolean(s && s.length >= 16));
  return valides.some((s) => egalConstant(enteteAuthorization, `Bearer ${s}`));
}
