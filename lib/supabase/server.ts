import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies, type UnsafeUnwrappedCookies } from "next/headers";

import type { Database } from "@/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { memoriserGetUser } from "@/lib/supabase/memo-get-user";

/**
 * Client Supabase côté serveur (RSC, route handlers, server actions).
 * Le contournement try/catch sur `set` est nécessaire car en pur RSC
 * les cookies sont en lecture seule.
 *
 * Mémoïsé par requête (React `cache`) : une page qui appelle cinq
 * actions n'instancie plus cinq clients. Surtout, `auth.getUser()` —
 * un aller-retour réseau vers Supabase Auth à CHAQUE appel, soit un
 * par action — n'est effectué qu'une fois par requête : la réponse
 * réussie est partagée entre toutes les actions de la même requête.
 * Une réponse sans utilisateur (session expirée, échec) n'est jamais
 * mémorisée, et une connexion/déconnexion n'appelle pas getUser après
 * coup dans la même requête (elles redirigent).
 */
export const createClient = cache(() => {
  // Next 15 : cookies() renvoie une promesse. createClient reste
  // synchrone (157 appels `createClient()` dans les actions, mémoïsé
  // par cache()) : l'accès synchrone est encore pris en charge en 15.x
  // (avertissement en développement seulement). À rendre asynchrone
  // avant Next 16, où cette forme disparaît.
  const cookieStore = cookies() as unknown as UnsafeUnwrappedCookies;

  const client = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Appel depuis un Server Component pur : ignorer.
        }
      },
    },
  });

  client.auth.getUser = memoriserGetUser(client.auth.getUser.bind(client.auth));

  return client;
});
