/**
 * Configuration Supabase publique avec valeurs en fallback.
 *
 * Pourquoi en clair dans le code : les `NEXT_PUBLIC_*` sont par conception
 * incluses dans le bundle JavaScript envoyé au navigateur. Hardcoder une
 * URL Supabase + une publishable key (préfixe `sb_publishable_`) est
 * équivalent à les avoir dans .env.local côté sécurité — elles sont
 * destinées à être visibles côté client.
 *
 * La sécurité réelle repose sur :
 * - Les Row Level Security (RLS) policies sur Supabase qui filtrent les
 *   données par `auth.uid() = user_id`
 * - L'auth email/password qui empêche tout accès non authentifié
 *
 * En cas de besoin (rotation de clé, multi-env), les valeurs sont
 * surchargeables via les variables d'environnement Vercel.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://bzsmhavrvurlmkfhbzyh.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_kMt5mpE2tX9G_zaRUBmZDw_hk_OlU_d";
