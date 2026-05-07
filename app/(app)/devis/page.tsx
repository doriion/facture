import Link from "next/link";
import { Plus } from "lucide-react";

import { listDevis } from "@/lib/actions/devis";
import { Button } from "@/components/ui/button";
import { DevisTable } from "@/components/devis/devis-table";
import { DevisToolbar } from "@/components/devis/devis-toolbar";

export const metadata = { title: "Devis — Facture AE" };

export default async function DevisPage({
  searchParams,
}: {
  searchParams: { search?: string; statut?: string; type?: string };
}) {
  const search = searchParams.search ?? "";
  const statut = searchParams.statut ?? "";
  const type = searchParams.type ?? "";

  const devis = await listDevis({ search, statut, type });

  const totalAffiche = devis.reduce((sum, d) => sum + Number(d.total_ht), 0);
  const accepted = devis.filter((d) => d.statut === "accepte").length;
  const sent = devis.filter((d) => d.statut === "envoye").length;
  const conversionRate =
    sent + accepted > 0 ? Math.round((accepted / (sent + accepted)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devis</h1>
          <p className="text-sm text-muted-foreground">
            {devis.length} devis —{" "}
            {totalAffiche.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
            })}{" "}
            HT cumulés
            {sent + accepted > 0 && (
              <>
                {" "}
                · taux d'acceptation : <strong>{conversionRate}%</strong>
              </>
            )}
          </p>
        </div>
        <Button asChild>
          <Link href="/devis/nouveau">
            <Plus className="size-4" />
            Nouveau devis
          </Link>
        </Button>
      </div>

      <DevisToolbar
        initialSearch={search}
        initialStatut={statut}
        initialType={type}
      />

      <DevisTable devis={devis} />
    </div>
  );
}
