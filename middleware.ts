import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

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
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
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
  const isPublicPage = path === "/login" || path.startsWith("/login/");

  if (!user && !isPublicPage) {
    if (path.startsWith("/api/")) {
      return new NextResponse("Non authentifié", { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Toujours renvoyer `response` telle quelle : elle porte les cookies
  // de session éventuellement rafraîchis.
  return response;
}

export const config = {
  matcher: [
    /*
     * Tout sauf :
     * - _next/static, _next/image (assets Next.js)
     * - favicon.ico, sw.js, manifest.json (PWA)
     * - fichiers statiques de /public (images, icônes)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
