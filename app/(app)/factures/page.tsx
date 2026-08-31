import Link from "next/link";
import { Plus } from "lucide-react";

import { listFactures } from "@/lib/actions/factures";
import { getFacturesEnRetard } from "@/lib/actions/relances";
import { Button } from "@/components/ui/button";
import { FacturesTable } from "@/components/factures/factures-table";
import { FacturesToolbar } from "@/components/factures/factures-toolbar";
import { RecategoriserBanner } from "@/components/factures/recategoriser-dialog";
import { RelancesSection } from "@/components/factures/relances-section";
import { MobileActionBar } from "@/components/mobile-action-bar";

export const metadata = { title: "Factures — Facture AE" };

export default async function FacturesPage({
  searchParams,
}: {
  searchParams: { search?: string; statut?: string; type?: string };
}) {
  const search = searchParams.search ?? "";
  const statut = searchParams.statut ?? "";
  const type = searchParams.type ?? "";

  const [factures, enRetard, facturesAutre] = await Promise.all([
    listFactures({ search, statut, type }),
    getFacturesEnRetard(),
    // Indépendant des filtres : toutes les « Autre » à requalifier
    listFactures({ type: "autre" }),
  ]);

  const aRecategoriser = facturesAutre
    .filter((f) => f.statut !== "annulee")
    .map((f) => ({
      id: f.id,
      numero: f.numero,
      date_emission: f.date_emission,
      total_ht: Number(f.total_ht),
      client_nom: f.client?.nom ?? null,
    }));

  // Total brut sur la liste filtrée (à titre indicatif)
  const totalAffiche = factures.reduce(
    (sum, f) => sum + Number(f.total_ht),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Factures</h1>
          <p className="text-sm text-muted-foreground">
            {factures.length} facture{factures.length > 1 ? "s" : ""} —{" "}
            {totalAffiche.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
            })}{" "}
            HT cumulés
          </p>
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

      <FacturesToolbar
        initialSearch={search}
        initialStatut={statut}
        initialType={type}
      />

      <FacturesTable factures={factures} />

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
