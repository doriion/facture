import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Racine : sur téléphone, l'accueil à grandes tuiles ; sur PC, l'agenda,
 * l'écran de travail principal. Le middleware (middleware.ts, à la
 * racine du repo) redirige vers /login si l'utilisateur n'est pas
 * authentifié.
 */
export default async function HomePage() {
  const ua = (await headers()).get("user-agent") ?? "";
  redirect(/iPhone|iPad|Android|Mobile/i.test(ua) ? "/accueil" : "/agenda");
}
