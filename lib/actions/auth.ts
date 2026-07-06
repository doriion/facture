"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/safe-next";

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
 * `next` = page demandée avant la redirection vers /login (posée par
 * le middleware). Validée par sanitizeNextPath : chemin interne
 * uniquement, sinon /dashboard.
 *
 * En cas d'erreur, renvoie un objet sérialisable. Sinon redirige.
 */
export async function signInAction(
  email: string,
  password: string,
  next?: string,
): Promise<SignInResult | void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: error.message };
  }

  // Force le re-render de toutes les pages (le user est maintenant connecté).
  revalidatePath("/", "layout");
  redirect(sanitizeNextPath(next));
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
