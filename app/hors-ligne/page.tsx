import Link from "next/link";
import { WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata = { title: "Hors connexion — NG Gestion" };

/**
 * Page servie par le service worker quand le réseau est coupé (tunnel,
 * sous-sol) : mieux qu'une page d'erreur du navigateur. Les données
 * restent en ligne uniquement ; on propose simplement de réessayer.
 */
export default function HorsLignePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-bold tracking-tight">Pas de connexion</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        L&apos;agenda et les factures ont besoin du réseau. Dès que vous
        retrouvez du signal, réessayez : rien n&apos;est perdu.
      </p>
      <Button asChild>
        <Link href="/agenda">Réessayer</Link>
      </Button>
    </div>
  );
}
