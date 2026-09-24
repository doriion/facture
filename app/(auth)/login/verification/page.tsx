import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { facteurTotpVerifie, verificationRequise } from "@/lib/mfa-helpers";
import { sanitizeNextPath } from "@/lib/safe-next";
import { MfaVerificationForm } from "@/components/mfa-verification-form";
import { NOM_APPLICATION, titrePage } from "@/lib/marque";

export const metadata = {
  title: titrePage("Vérification"),
};

/**
 * Deuxième étape de la connexion (double authentification). Sans
 * session : retour à la connexion ; session déjà vérifiée ou sans
 * facteur : on ouvre directement la page demandée.
 */
export default async function VerificationPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: facteurs }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const totp = facteurs?.totp ?? [];
  if (!facteurTotpVerifie(totp) || !verificationRequise(aal?.currentLevel, totp)) {
    redirect(sanitizeNextPath(searchParams.next));
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">{NOM_APPLICATION}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <MfaVerificationForm nextPath={searchParams.next} />
      </div>
    </div>
  );
}
