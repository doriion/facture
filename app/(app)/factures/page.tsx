import Link from "next/link";
import { Plus } from "lucide-react";

import { listFactures } from "@/lib/actions/factures";
import { getFacturesEnRetard } from "@/lib/actions/relances";
import { Button } from "@/components/ui/button";
import { FacturesListe } from "@/components/factures/factures-liste";
import { RecategoriserBanner } from "@/components/factures/recategoriser-dialog";
import { RelancesSection } from "@/components/factures/relances-section";
import { MobileActionBar } from "@/components/mobile-action-bar";

export const metadata = { title: "Factures — NG Gestion" };

export default async function FacturesPage({
  searchParams,
}: {
  searchParams: { search?: string; statut?: string; type?: string };
}) {
  const search = searchParams.search ?? "";
  const statut = searchParams.statut ?? "";
  const type = searchParams.type ?? "";

  // Liste entière : la recherche et les filtres s'appliquent sur le
  // téléphone (FacturesListe), sans aller-retour serveur.
  const [factures, enRetard] = await Promise.all([listFactures(), getFacturesEnRetard()]);

  // Indépendant des filtres : toutes les « Autre » à requalifier
  const aRecategoriser = factures
    .filter((f) => f.type_activite === "autre" && f.statut !== "annulee")
    .map((f) => ({
      id: f.id,
      numero: f.numero,
      date_emission: f.date_emission,
      total_ht: Number(f.total_ht),
      client_nom: f.client?.nom ?? null,
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Factures</h1>
        </div>
        {/* Desktop : CTA en haut à droite. Mobile : barre fixe en bas. */}
        <Button asChild className="max-md:hidden">
          <Link href="/factures/nouvelle">
            <Plus className="size-4" />
            Nouvelle facture
          </Link>
        </Button>
      </div>

      <RelancesSection factures={enRetard.factures} />

      <RecategoriserBanner factures={aRecategoriser} />

      <FacturesListe factures={factures} initial={{ search, statut, type }} />

      <MobileActionBar>
        <Button asChild size="lg">
          <Link href="/factures/nouvelle">
            <Plus className="size-4" />
            Nouvelle facture
          </Link>
        </Button>
      </MobileActionBar>
    </div>
  );
}
