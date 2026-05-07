"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type SignInResult = { ok: false; error: string };

/**
 * Authentifie l'utilisateur via une Server Action.
 *
 * Pattern recommandé par Supabase pour Next.js App Router :
 * la Server Action s'exécute côté serveur, peut écrire les cookies
 * de session sur la réponse, puis redirige avec `redirect()`. Cela
 * évite le souci de désynchronisation cookies client/serveur que
 * l'on a en faisant `signInWithPassword` côté client puis
 * `router.push` (la navigation se déclenche avant que les cookies
 * soient lus par le layout serveur).
 *
 * En cas d'erreur, renvoie un objet sérialisable. Sinon redirige.
 */
export async function signInAction(
  email: string,
  password: string,
): Promise<SignInResult | void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: error.message };
  }

  // Force le re-render de toutes les pages (le user est maintenant connecté).
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Déconnexion via Server Action — efface les cookies côté serveur.
 */
export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
