import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Client Supabase SERVICE ROLE — réservé aux tâches planifiées
 * (/api/cron/*) qui tournent SANS session utilisateur.
 *
 * ⚠️ Ce client CONTOURNE la RLS : chaque requête doit filtrer
 * explicitement par user_id (les jobs itèrent sur profil_entreprise et
 * passent le user_id partout). Ne JAMAIS l'importer depuis un composant
 * ou une server action utilisateur — `server-only` + vérification de
 * la variable d'env le cantonnent au serveur.
 *
 * Variable Vercel requise : SUPABASE_SERVICE_ROLE_KEY (Dashboard
 * Supabase → Settings → API → service_role). À ajouter en Production
 * ET Preview avant d'activer les crons.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante — requise pour les tâches planifiées.",
    );
  }
  return createSupabaseClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ServiceClient = ReturnType<typeof createServiceClient>;
