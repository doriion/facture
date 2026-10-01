import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { verificationRequise } from "@/lib/mfa-helpers";
import { EN_TETE_UTILISATEUR, encoderUtilisateur } from "@/lib/auth-transmise";

/**
 * Middleware d'auth Supabase (pattern officiel @supabase/ssr pour
 * App Router) :
 *
 * 1. Rafraîchit la session à chaque navigation via `auth.getUser()` —
 *    sans ce refresh les tokens expirent et l'utilisateur est déconnecté
 *    au bout d'une heure même en pleine utilisation.
 * 2. Bloque les routes protégées : redirect vers /login pour les pages,
 *    401 pour les routes /api (un PDF ne doit pas répondre par une page
 *    de login HTML).
 *
 * Le garde dans app/(app)/layout.tsx est conservé en double sécurité
 * (défense en profondeur si le matcher est contourné), et la RLS
 * Supabase reste la protection ultime des données.
 */
export async function middleware(request: NextRequest) {
  // Cookies rafraîchis par Supabase pendant getUser : posés sur la
  // réponse construite à la fin (quand l'identité est connue).
  let cookiesRafraichis: Array<{ name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] }> = [];

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesRafraichis = cookiesToSet;
        },
      },
    },
  );

  // IMPORTANT : getUser() (et non getSession()) — valide le JWT auprès
  // de Supabase et déclenche le refresh des tokens expirés.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Chemins publics :
  // - /login : authentification ;
  // - /c/… : page de signature d'un contrat par le client (l'accès est
  //   contrôlé par l'access_token du contrat, résolu côté serveur) ;
  // - /api/public/… : les routes serveur de ce même parcours ;
  // - /api/cron/… : tâches planifiées appelées SANS session (Vercel
  //   Cron, pg_cron) — chaque route vérifie elle-même son secret
  //   (Authorization: Bearer …) et refuse tout le reste.
  const isPublicPage =
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/hors-ligne" ||
    path.startsWith("/c/") ||
    path.startsWith("/api/public/") ||
    path.startsWith("/api/cron/");

  if (!user && !isPublicPage) {
    // Navigation directe vers une route API (PDF ouvert dans un onglet,
    // lien mémorisé) avec session expirée : on emmène à la connexion
    // puis on revient au document, au lieu d'un « Non authentifié » nu.
    // Les appels fetch/JS gardent le 401.
    const navigation =
      request.method === "GET" &&
      (request.headers.get("accept") ?? "").includes("text/html");
    if (path.startsWith("/api/") && !navigation) {
      return new NextResponse("Non authentifié", { status: 401 });
    }
    const url = request.nextUrl.clone();
    const nextPath = path + request.nextUrl.search;
    url.pathname = "/login";
    url.search = "";
    // Mémorise la page demandée pour y revenir après connexion
    // (validé côté login par sanitizeNextPath — chemin interne only).
    if (nextPath !== "/" && nextPath !== "/agenda") {
      url.searchParams.set("next", nextPath);
    }
    return NextResponse.redirect(url);
  }

  // Double authentification activée mais session au mot de passe seul
  // (aal1) : rien d'autre que la page de vérification. `user.factors`
  // vient de getUser() (à jour), le niveau courant du JWT.
  if (user && !isPublicPage) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (verificationRequise(aal?.currentLevel, user.factors)) {
      if (path.startsWith("/api/")) {
        return new NextResponse("Double authentification requise", { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/login/verification";
      url.search = "";
      url.searchParams.set("next", path + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }

  // En-têtes de la requête transmise au rendu : les cookies rafraîchis
  // (request.cookies.set les a déjà reportés) et l'identité validée —
  // le layout n'a plus à rappeler Supabase Auth. Toute valeur de cet
  // en-tête venant du client est effacée : seul le middleware le pose.
  const enTetesRequete = new Headers(request.headers);
  enTetesRequete.delete(EN_TETE_UTILISATEUR);
  if (user) enTetesRequete.set(EN_TETE_UTILISATEUR, encoderUtilisateur({ id: user.id, email: user.email ?? "" }));
  const response = NextResponse.next({ request: { headers: enTetesRequete } });
  cookiesRafraichis.forEach(({ name, value, options }) => response.cookies.set(name, value, options));

  // Pages et routes publiques (lien de signature, PDF public) : jamais
  // indexées par un moteur de recherche.
  if (path.startsWith("/c/") || path.startsWith("/api/public/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  // `response` porte les cookies de session éventuellement rafraîchis.
  return response;
}

export const config = {
  matcher: [
    /*
     * Tout sauf :
     * - _next/static, _next/image (assets Next.js)
     * - favicon.ico, sw.js, manifest.json (PWA), robots.txt (sinon les
     *   robots étaient redirigés vers la page de connexion et le
     *   « Disallow » n'était jamais lu)
     * - fichiers statiques de /public (images, icônes)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.json|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
