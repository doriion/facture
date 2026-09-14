import Link from "next/link";
import { Plus } from "lucide-react";

import { listDevis, listModelesDevis } from "@/lib/actions/devis";
import { Button } from "@/components/ui/button";
import { DevisTable } from "@/components/devis/devis-table";
import { DevisToolbar } from "@/components/devis/devis-toolbar";
import { ModelesDevisSection } from "@/components/devis/modeles-devis-section";
import { NouveauDepuisModeleMenu } from "@/components/devis/nouveau-depuis-modele-menu";
import { MobileActionBar } from "@/components/mobile-action-bar";

export const metadata = { title: "Devis — NG Gestion" };

export default async function DevisPage({
  searchParams,
}: {
  searchParams: { search?: string; statut?: string; type?: string };
}) {
  const search = searchParams.search ?? "";
  const statut = searchParams.statut ?? "";
  const type = searchParams.type ?? "";

  const [devis, modeles] = await Promise.all([
    listDevis({ search, statut, type }),
    listModelesDevis(),
  ]);

  const totalAffiche = devis.reduce((sum, d) => sum + Number(d.total_ht), 0);
  const accepted = devis.filter((d) => d.statut === "accepte").length;
  const sent = devis.filter((d) => d.statut === "envoye").length;
  const conversionRate =
    sent + accepted > 0 ? Math.round((accepted / (sent + accepted)) * 100) : 0;

  // Le menu ne reçoit que ce qui sert à lister par nom.
  const modelesMenu = modeles.map((m) => ({
    id: m.id,
    numero: m.numero,
    nom_modele: m.nom_modele,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Devis</h1>
          <p className="text-sm text-muted-foreground">
            {devis.length} devis —{" "}
            {totalAffiche.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
            })}{" "}
            cumulés
            {sent + accepted > 0 && (
              <>
                {" "}
                · taux d'acceptation : <strong>{conversionRate}%</strong>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 max-md:hidden">
          <NouveauDepuisModeleMenu modeles={modelesMenu} />
          <Button asChild>
            <Link href="/devis/nouveau">
              <Plus className="size-4" />
              Nouveau devis
            </Link>
          </Button>
        </div>
      </div>

      <ModelesDevisSection modeles={modeles} />

      <DevisToolbar
        initialSearch={search}
        initialStatut={statut}
        initialType={type}
      />

      <DevisTable devis={devis} />

      <MobileActionBar>
        <NouveauDepuisModeleMenu
          modeles={modelesMenu}
          size="lg"
          className="px-3"
          libelle="Depuis un modèle"
        />
        <Button asChild size="lg">
          <Link href="/devis/nouveau">
            <Plus className="size-4" />
            Nouveau devis
          </Link>
        </Button>
      </MobileActionBar>
    </div>
  );
}
