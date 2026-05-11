import Link from "next/link";
import { Plus } from "lucide-react";

import { listFactures } from "@/lib/actions/factures";
import { Button } from "@/components/ui/button";
import { FacturesTable } from "@/components/factures/factures-table";
import { FacturesToolbar } from "@/components/factures/factures-toolbar";

export const metadata = { title: "Factures — Facture AE" };

export default async function FacturesPage({
  searchParams,
}: {
  searchParams: { search?: string; statut?: string; type?: string };
}) {
  const search = searchParams.search ?? "";
  const statut = searchParams.statut ?? "";
  const type = searchParams.type ?? "";

  const factures = await listFactures({ search, statut, type });

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
        <Button asChild>
          <Link href="/factures/nouvelle">
            <Plus className="size-4" />
            Nouvelle facture
          </Link>
        </Button>
      </div>

      <FacturesToolbar
        initialSearch={search}
        initialStatut={statut}
        initialType={type}
      />

      <FacturesTable factures={factures} />
    </div>
  );
}
