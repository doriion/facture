/**
 * Configuration Supabase publique, lue exclusivement depuis les
 * variables d'environnement (`.env.local` en dev, variables projet
 * sur Vercel en prod).
 *
 * Les `NEXT_PUBLIC_*` sont inlinées dans le bundle au build : si une
 * variable manque, on échoue immédiatement avec un message explicite
 * plutôt que de laisser l'app planter plus loin avec une erreur réseau
 * incompréhensible.
 *
 * La sécurité réelle repose sur :
 * - Les Row Level Security (RLS) policies sur Supabase qui filtrent les
 *   données par `auth.uid() = user_id`
 * - L'auth email/password qui empêche tout accès non authentifié
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        "Renseignez-la dans .env.local (voir .env.example) ou dans les " +
        "variables d'environnement du projet Vercel.",
    );
  }
  return value;
}

export const SUPABASE_URL = requireEnv(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_ANON_KEY = requireEnv(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
