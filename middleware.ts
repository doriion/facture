import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware Edge ultra-léger : redirection rapide vers /login si aucun
 * cookie de session Supabase n'est présent. La vraie validation (parser
 * le JWT, vérifier qu'il n'est pas expiré, rafraîchir si besoin) est faite
 * dans le layout authentifié `app/(app)/layout.tsx` qui tourne en runtime
 * Node.js.
 *
 * Pourquoi ce design :
 * - `@supabase/ssr` bundle du code Node-only (`__dirname`) qui crash à
 *   l'exécution dans le runtime Edge de Vercel. Garder le middleware
 *   minimal évite ce problème et reste très rapide.
 * - La sécurité n'est pas dégradée : la RLS Supabase + la double-vérif
 *   dans le layout garantissent qu'aucune donnée ne fuite, même si un
 *   cookie est forgé/expiré.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  // Heuristique : si un cookie Supabase est présent, on suppose que la
  // session est valide. Le layout fera la vérification stricte.
  const hasSupabaseSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  if (!hasSupabaseSession && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSupabaseSession && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf :
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation d'images)
     * - favicon.ico
     * - fichiers à extension (png, svg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
