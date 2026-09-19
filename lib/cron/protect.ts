import "server-only";

import { autorisationCron } from "@/lib/cron/autorisation";

/**
 * Protection des routes /api/cron/*. Deux déclencheurs, deux secrets
 * (voir lib/cron/autorisation) :
 * - Vercel Cron : `Authorization: Bearer CRON_SECRET` ;
 * - pg_cron Supabase (via pg_net) : `Bearer PUSH_CRON_SECRET`.
 * Aucune variable configurée → tout est refusé.
 */
export function estAppelCronAutorise(request: Request): boolean {
  return autorisationCron(request.headers.get("authorization"), [
    process.env.CRON_SECRET,
    process.env.PUSH_CRON_SECRET,
  ]);
}
