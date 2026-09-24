import Link from "next/link";
import { WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata = { title: "Hors connexion — NG Gestion" };

/**
 * Page servie par le service worker quand le réseau est coupé (tunnel,
 * sous-sol) ET que l'écran demandé n'a jamais été mis en cache. Les
 * écrans déjà visités (et les principaux, préchauffés après connexion)
 * restent lisibles : on renvoie vers l'agenda.
 */
export default function HorsLignePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-bold tracking-tight">Pas de connexion</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Cet écran n&apos;a pas encore été enregistré sur ce téléphone. Les
        écrans déjà ouverts (agenda, factures, devis, clients…) restent
        consultables ; rien ne s&apos;enregistre tant que le réseau ne
        revient pas.
      </p>
      <Button asChild>
        <Link href="/agenda">Ouvrir l&apos;agenda</Link>
      </Button>
    </div>
  );
}
