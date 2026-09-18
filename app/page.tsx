import { redirect } from "next/navigation";

/**
 * Racine : redirige vers l'agenda, l'écran de travail principal. Le
 * middleware (middleware.ts, à la racine du repo) redirige vers /login
 * si l'utilisateur n'est pas authentifié.
 */
export default function HomePage() {
  redirect("/agenda");
}
