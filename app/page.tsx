import { redirect } from "next/navigation";

/**
 * Racine : redirige vers /dashboard. Le middleware se charge de rediriger
 * vers /login si l'utilisateur n'est pas authentifié.
 */
export default function HomePage() {
  redirect("/dashboard");
}
