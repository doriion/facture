import Link from "next/link";
import { Plus } from "lucide-react";

import { listFichesGaz } from "@/lib/actions/fiches-gaz";
import { FichesGazListe } from "@/components/fiches-gaz/fiches-gaz-liste";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Fiches gaz — NG Gestion" };

export default async function FichesGazPage() {
  const fiches = await listFichesGaz();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Fiches gaz</h1>
          <p className="text-sm text-muted-foreground">
            Fiches d&apos;intervention fluides frigorigènes (CERFA 15497) et bons de réception : mise en service, entretien, contrôle d&apos;étanchéité. Signature du client sur place ou en ligne.
          </p>
        </div>
        <Button asChild className="max-md:hidden">
          <Link href="/fiches-gaz/nouvelle">
            <Plus className="size-4" />
            Nouvelle fiche
          </Link>
        </Button>
      </div>

      <FichesGazListe fiches={fiches} />

      <MobileActionBar>
        <Button asChild size="lg">
          <Link href="/fiches-gaz/nouvelle">
            <Plus className="size-4" />
            Nouvelle fiche
          </Link>
        </Button>
      </MobileActionBar>
    </div>
  );
}
