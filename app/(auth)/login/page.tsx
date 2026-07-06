import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Connexion — Facture AE",
};

/**
 * Page de connexion. Application mono-utilisateur : pas de signup public.
 * Le compte unique est créé manuellement côté Supabase.
 *
 * `?next=` (posé par le middleware) = page à rouvrir après connexion ;
 * transmis au formulaire puis validé côté serveur (sanitizeNextPath).
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Facture AE
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestion factures &amp; devis — Auto-entrepreneur BTP
          </p>
        </div>
        <LoginForm nextPath={searchParams.next} />
      </div>
    </div>
  );
}
